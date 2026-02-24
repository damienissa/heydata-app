import {
  HeyDataError,
  ValidationResultSchema,
  type GeneratedSQL,
  type IntentObject,
  type SemanticMetadata,
  type SqlValidationIssue,
  type ValidationResult,
} from "@heydata/shared";
import type { AgentContext, AgentInput, AgentResult } from "../types.js";
import {
  createErrorTrace,
  createSuccessTrace,
  extractTokenUsage,
} from "../types.js";

export interface SqlValidatorInput extends AgentInput {
  generatedSql: GeneratedSQL;
  intent: IntentObject;
  semanticMetadata?: SemanticMetadata;
}

// Forbidden SQL keywords for security
const FORBIDDEN_KEYWORDS = [
  "DROP",
  "DELETE",
  "TRUNCATE",
  "INSERT",
  "UPDATE",
  "ALTER",
  "CREATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
  "CALL",
  "INTO OUTFILE",
  "INTO DUMPFILE",
  "LOAD_FILE",
  "LOAD DATA",
];

const SYSTEM_PROMPT = `You are an expert SQL validator. Analyze the given SQL query for potential issues.

Check for:
1. Syntax errors (invalid SQL syntax for the target dialect)
2. Semantic issues — ONLY flag table/column mismatches if you have schema context below; otherwise skip this check
3. Performance concerns (cartesian products, missing GROUP BY, unnecessary full scans)
4. Security issues (SQL injection vulnerabilities, unsafe patterns)
5. Intent mismatch — the query structure is fundamentally wrong for the question type:
   - ERROR: User asked for a trend over time but query has no date column in GROUP BY
   - ERROR: User asked for top N but query has no ORDER BY + LIMIT
   - OK: Extra SELECT columns beyond what was requested — not an error
   - OK: Minor differences in filter values or column ordering — not an error
   - OK: CTEs and subqueries added for correctness — not an error

For each issue found, specify:
- type: "syntax", "semantic", "performance", "security", or "intent_mismatch"
- severity: "error" (must fix), "warning" (should fix), or "info" (nice to have)
- message: Description of the issue
- suggestion: How to fix it
- line: Line number if applicable

Also provide a confidence score (0.0-1.0) for the overall validity of the query.

Respond with a JSON object containing:
- valid: boolean (true if no errors, warnings don't count)
- issues: array of issues found
- confidence: number between 0 and 1`;

function performStaticChecks(sql: string): SqlValidationIssue[] {
  const issues: SqlValidationIssue[] = [];
  const upperSql = sql.toUpperCase();

  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Use word boundary to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(sql)) {
      issues.push({
        type: "security",
        severity: "error",
        message: `Forbidden SQL operation detected: ${keyword}`,
        suggestion: "Only SELECT queries are allowed",
      });
    }
  }

  // Check for suspicious patterns
  if (upperSql.includes("--") || upperSql.includes("/*")) {
    issues.push({
      type: "security",
      severity: "warning",
      message: "SQL comments detected which could indicate injection attempts",
      suggestion: "Review the query for potential SQL injection",
    });
  }

  // Check for missing WHERE clause on large tables
  if (!upperSql.includes("WHERE") && !upperSql.includes("LIMIT")) {
    issues.push({
      type: "performance",
      severity: "warning",
      message: "Query has no WHERE clause or LIMIT",
      suggestion: "Consider adding filters or a LIMIT clause to avoid large result sets",
    });
  }

  // Check for SELECT *
  if (/SELECT\s+\*\s+FROM/i.test(sql)) {
    issues.push({
      type: "performance",
      severity: "info",
      message: "SELECT * may return unnecessary columns",
      suggestion: "Consider specifying only the required columns",
    });
  }

  return issues;
}

function buildUserMessage(
  generatedSql: GeneratedSQL,
  intent: IntentObject,
  semanticMetadata?: SemanticMetadata,
): string {
  const schemaContext = semanticMetadata
    ? `\n\n## Semantic Layer Reference\n\n${semanticMetadata.semanticMarkdown}`
    : "";

  return `Validate the following SQL query:

SQL:
\`\`\`sql
${generatedSql.sql}
\`\`\`

Target dialect: ${generatedSql.dialect}
Tables touched: ${generatedSql.tablesTouched.join(", ")}
Estimated complexity: ${generatedSql.estimatedComplexity ?? "unknown"}

Original intent (queryType: ${intent.queryType}, metrics: ${intent.metrics.join(", ")}, dimensions: ${intent.dimensions.join(", ")})${schemaContext}

Validate that the SQL correctly implements the intent and check for any issues.`;
}

export async function validateSql(
  input: SqlValidatorInput,
): Promise<AgentResult<ValidationResult>> {
  const startedAt = new Date();
  const { context, generatedSql, intent, semanticMetadata } = input;

  // First, perform static checks
  const staticIssues = performStaticChecks(generatedSql.sql);

  // If we have security errors, fail fast
  const securityErrors = staticIssues.filter(
    (i) => i.type === "security" && i.severity === "error",
  );
  if (securityErrors.length > 0) {
    return {
      data: {
        valid: false,
        issues: staticIssues,
        confidence: 1.0,
      },
      trace: createSuccessTrace({
        agent: "sql_validator",
        model: context.model,
        startedAt,
        inputTokens: 0,
        outputTokens: 0,
      }),
    };
  }

  // For low-complexity queries with no static errors, skip the LLM call
  const hasStaticErrors = staticIssues.some((i) => i.severity === "error");
  if (generatedSql.estimatedComplexity === "low" && !hasStaticErrors) {
    return {
      data: {
        valid: true,
        issues: staticIssues,
        confidence: 0.85,
      },
      trace: createSuccessTrace({
        agent: "sql_validator",
        model: context.model,
        startedAt,
        inputTokens: 0,
        outputTokens: 0,
      }),
    };
  }

  try {
    const userMessage = buildUserMessage(generatedSql, intent, semanticMetadata);

    const response = await context.client.messages.create({
      model: context.model,
      max_tokens: 1024,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new HeyDataError(
        "SQL_VALIDATION_FAILED",
        "No text response from SQL validator",
        { agent: "sql_validator" },
      );
    }

    // Extract JSON from the response
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const llmResult = ValidationResultSchema.parse(parsed);

    // Merge static issues with LLM-found issues
    const allIssues = [...staticIssues, ...llmResult.issues];
    const hasErrors = allIssues.some((i) => i.severity === "error");

    const { inputTokens, outputTokens } = extractTokenUsage(response);

    return {
      data: {
        valid: !hasErrors,
        issues: allIssues,
        confidence: llmResult.confidence,
      },
      trace: createSuccessTrace({
        agent: "sql_validator",
        model: context.model,
        startedAt,
        inputTokens,
        outputTokens,
      }),
    };
  } catch (error) {
    if (error instanceof HeyDataError) {
      throw error;
    }

    const trace = createErrorTrace(
      {
        agent: "sql_validator",
        model: context.model,
        startedAt,
      },
      error instanceof Error ? error : new Error(String(error)),
    );

    throw new HeyDataError(
      "SQL_VALIDATION_FAILED",
      `Failed to validate SQL: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "sql_validator", details: { trace } },
    );
  }
}
