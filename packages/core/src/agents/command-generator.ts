import { HeyDataError } from "@heydata/shared";
import { z } from "zod";
import type { AgentInput, AgentResult } from "../types.js";
import { createSuccessTrace, extractTokenUsage } from "../types.js";

// ── Output types ─────────────────────────────────────────────────────────────

export const GeneratedCommandSchema = z.object({
  slashCommand: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "camelCase or underscore_case, no spaces or leading slash"),
  description: z.string().max(80),
  prompt: z.string(),
});

export type GeneratedCommand = z.infer<typeof GeneratedCommandSchema>;

export interface CommandGeneratorOutput {
  commands: GeneratedCommand[];
}

export interface CommandGeneratorInput extends AgentInput {
  semanticMarkdown: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an analytics assistant. Given a semantic layer document, generate 5–10 useful slash commands for a data chat interface.

Each command should:
- Target a concrete, high-value metric or insight already defined in the semantic layer
- Be something users would repeat frequently (KPIs, trends, top N, funnels, distributions)
- Have a short camelCase or underscore_case name without a leading slash (e.g. showMRR, topProducts, weeklyActiveUsers)
- Have a concise description (max 80 chars) shown in the command picker
- Have a clear, self-contained prompt the user could type in the chat

## Available visualization types

The chat interface supports these chart types. Reference them by name in your prompts to get the best visual output:

| Type | Best for |
|------|----------|
| line | Trends over time (revenue, signups, active users) |
| bar | Comparisons across categories (top products, sales by region) |
| area | Cumulative or stacked trends (revenue by segment over time) |
| scatter | Correlations between two numeric values |
| composed | Mixed line + bar on same chart (e.g. revenue bars + growth rate line) |
| kpi | Single headline number with optional comparison to prior period |
| table | Detailed row-level data, ranked lists, multi-column reports |
| pie | Part-of-whole for a small number of categories (share of revenue) |
| donut | Same as pie but with a centre label for the total |
| funnel | Conversion steps (signup → trial → paid → retained) |
| radar | Multi-dimension scoring or performance profiles |
| treemap | Hierarchical proportions (revenue by category → subcategory) |
| waterfall | Running totals with incremental changes (cash flow, P&L bridge) |
| histogram | Distribution of a single numeric value (order size, session length) |
| gauge | Single metric vs. a target or threshold (NPS, quota attainment) |
| heatmap | Two-dimensional intensity (activity by day × hour, cohort retention) |

Include the chart type in the prompt so the AI chooses the right visualisation. Example phrasing:
- "…show it as a line chart"
- "…display as a KPI card with comparison to last month"
- "…render as a funnel chart"
- "…use a bar chart sorted descending"

Rules:
- No duplicate slashCommand values
- slashCommand must match /^[a-zA-Z][a-zA-Z0-9_]*$/
- Prompts should be natural questions, not SQL
- Prefer metrics explicitly listed in the ## Metrics section
- Each prompt should mention a specific chart type from the table above
- Call the save_commands tool with the generated commands`;

// ── Tool definition for structured output ─────────────────────────────────────

const COMMANDS_TOOL = {
  name: "save_commands",
  description: "Save the generated slash commands",
  input_schema: {
    type: "object" as const,
    properties: {
      commands: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slashCommand: {
              type: "string",
              description: "camelCase or underscore_case command name, no leading slash",
            },
            description: {
              type: "string",
              description: "Short description shown in the picker, max 80 chars",
            },
            prompt: {
              type: "string",
              description: "Full prompt sent to the chat when the command is selected",
            },
          },
          required: ["slashCommand", "description", "prompt"],
        },
      },
    },
    required: ["commands"],
  },
};

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function generateCommands(
  input: CommandGeneratorInput,
): Promise<AgentResult<CommandGeneratorOutput>> {
  const startedAt = new Date();
  const { context, semanticMarkdown } = input;

  try {
    console.log(`[command-generator] Starting command generation (model: ${context.fastModel})`);

    const response = await context.client.messages.create(
      {
        model: context.fastModel,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [COMMANDS_TOOL],
        tool_choice: { type: "tool", name: "save_commands" },
        messages: [
          {
            role: "user",
            content: `Generate slash commands from this semantic layer:\n\n${semanticMarkdown}`,
          },
        ],
      },
      context.signal ? { signal: context.signal } : undefined,
    );

    const { inputTokens, outputTokens } = extractTokenUsage(response);
    console.log(
      `[command-generator] Complete — input: ${inputTokens} tokens, output: ${outputTokens} tokens`,
    );

    // With tool_choice forced to "save_commands", the SDK guarantees a tool_use block
    // with input already parsed as JSON — no text extraction or JSON.parse needed.
    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new HeyDataError(
        "COMMAND_GENERATION_FAILED",
        "Command generator returned no tool_use block",
        { agent: "command_generator" },
      );
    }

    const rawInput = toolBlock.input as { commands?: unknown[] };
    const rawCommands = rawInput.commands ?? [];

    const commands: GeneratedCommand[] = [];
    for (const item of rawCommands) {
      const parsed = GeneratedCommandSchema.safeParse(item);
      if (parsed.success) {
        commands.push(parsed.data);
      }
    }

    // Deduplicate by slashCommand
    const seen = new Set<string>();
    const unique = commands.filter((c) => {
      if (seen.has(c.slashCommand)) return false;
      seen.add(c.slashCommand);
      return true;
    });

    console.log(`[command-generator] Generated ${unique.length} valid commands`);

    return {
      data: { commands: unique },
      trace: createSuccessTrace({
        agent: "command_generator",
        model: context.fastModel,
        startedAt,
        inputTokens,
        outputTokens,
      }),
    };
  } catch (error) {
    if (error instanceof HeyDataError) throw error;
    throw new HeyDataError(
      "COMMAND_GENERATION_FAILED",
      `Command generation failed: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "command_generator", cause: error instanceof Error ? error : undefined },
    );
  }
}

/**
 * Run command generation with default context (API key from env).
 * Use this from API routes; no need to pass an Anthropic client.
 */
export async function generateCommandsFromSemantic(
  semanticMarkdown: string,
  options?: { signal?: AbortSignal },
): Promise<CommandGeneratorOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new HeyDataError("CONFIG_ERROR", "ANTHROPIC_API_KEY is required for command generation", {
      agent: "command_generator",
    });
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const result = await generateCommands({
    context: {
      requestId: `cmd_${Date.now()}`,
      client,
      model: "claude-haiku-4-5-20251001",
      fastModel: "claude-haiku-4-5-20251001",
      dialect: "postgresql",
      signal: options?.signal,
    },
    semanticMarkdown,
  });

  return result.data;
}
