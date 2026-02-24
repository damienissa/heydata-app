import {
  HeyDataError,
  VisualizationSpecSchema,
  type IntentObject,
  type ResultSet,
  type VisualizationSpec,
} from "@heydata/shared";
import type { AgentContext, AgentInput, AgentResult } from "../types.js";
import {
  createErrorTrace,
  createSuccessTrace,
  extractTokenUsage,
} from "../types.js";

export interface VizPlannerInput extends AgentInput {
  intent: IntentObject;
  resultSet: ResultSet;
  /** Semantic layer markdown describing the data model, metrics, and dimensions */
  semanticMd?: string;
}

const SYSTEM_PROMPT = `You are an expert data visualization designer. Given query results and user intent, select the optimal visualization.

⚠️ CRITICAL RULE: Every "dataKey", "nameKey", "valueKey", "xKey", "yKey", "angleKey", "sizeKey", "categoryKey", "kpiValue" etc. MUST be an EXACT column name from the "Data Schema" section provided. Never invent or guess column names.

CHART SELECTION — apply in order, use the first match:
1. queryType == "trend" AND a date/time dimension exists → "line"
2. queryType == "ranking" → "bar" (sorted descending)
3. queryType == "distribution" AND ≤8 unique values → "pie" or "donut"
4. queryType == "distribution" AND >8 unique values OR numeric variable → "histogram"
5. queryType == "comparison" AND ≤8 categories → "bar"
6. queryType == "comparison" AND >8 categories → "table"
7. 2 numeric metrics with very different scales (e.g., count vs. rate) → "composed" (dual axis)
8. Exactly 2 numeric metrics with similar scales → "scatter"
9. More than 5 columns OR more than 50 rows AND no clear pattern → "table"
10. Default fallback → "bar"

CHART TYPE QUICK REFERENCE:
- "line": trends over time (needs a date/time x-axis)
- "bar": comparisons across categories
- "area": cumulative data or volume over time
- "scatter": correlations between two metrics
- "composed": dual-axis charts with multiple metrics
- "kpi": single important metric (1 row, 1 metric)
- "table": many dimensions or detailed data
- "pie": parts of a whole (2-8 categories, use for proportional data)
- "donut": same as pie with hollow center
- "funnel": sequential stages with drop-off
- "radar": comparing multiple dimensions of 2-3 items
- "treemap": hierarchical data proportions
- "waterfall": sequential positive/negative changes
- "histogram": distribution of a single numeric variable
- "gauge": single metric against a target/range (1 row, 1 metric)
- "heatmap": magnitude across two categorical dimensions (requires exactly 2 dims + 1 measure)

CONFIGURATION RULES:

For line / bar / area / scatter / composed:
- xAxis.dataKey: the category or time column
- yAxis.dataKey: not used for rendering (put the primary metric label here); actual values come from series[].dataKey
- series[]: one entry per metric line/bar, dataKey must be the exact column name

For pie / donut (chartConfig is MANDATORY):
- series: [] (leave empty)
- chartConfig.type: "pie" or "donut" (must match chartType)
- chartConfig.nameKey: EXACT column name of the category/label column (string values)
- chartConfig.valueKey: EXACT column name of the numeric metric column
- chartConfig.labelType: "percent" (default) | "value" | "name" | "none"

For funnel (chartConfig is MANDATORY):
- series: []
- chartConfig.type: "funnel"
- chartConfig.nameKey: EXACT column name for stage labels
- chartConfig.valueKey: EXACT column name for stage values

For radar (chartConfig is MANDATORY):
- chartConfig.type: "radar"
- chartConfig.angleKey: EXACT column name for the dimension axis
- series[]: one entry per item being compared (dataKey = EXACT metric column)

For treemap (chartConfig is MANDATORY):
- series: []
- chartConfig.type: "treemap"
- chartConfig.nameKey: EXACT column name for labels
- chartConfig.sizeKey: EXACT column name for the numeric size value

For waterfall (chartConfig is MANDATORY):
- series: []
- chartConfig.type: "waterfall"
- chartConfig.categoryKey: EXACT column name for category labels
- chartConfig.valueKey: EXACT column name for numeric change values

For histogram (chartConfig is MANDATORY):
- series: []
- chartConfig.type: "histogram"
- chartConfig.valueKey: EXACT column name for the numeric variable to distribute

For gauge (chartConfig is MANDATORY):
- series: []
- chartConfig.type: "gauge"
- chartConfig.valueKey: EXACT column name for the metric value
- chartConfig.min: minimum of the scale (number)
- chartConfig.max: maximum of the scale (number)
- chartConfig.target: target value (optional, number)

For heatmap (chartConfig is MANDATORY):
- series: []
- chartConfig.type: "heatmap"
- chartConfig.xKey: EXACT column name for the x-axis categorical dimension
- chartConfig.yKey: EXACT column name for the y-axis categorical dimension
- chartConfig.valueKey: EXACT column name for the numeric measure
- chartConfig.colorScale: "blue" | "green" | "red" | "diverging"

For kpi:
- kpiValue: EXACT column name of the metric
- kpiLabel: human-readable label (can be formatted)
- series: []

WORKED EXAMPLES (column names are illustrative — always use actual column names from the schema):

Example 1 — Line chart (data has columns: week, total_clicks):
{
  "chartType": "line",
  "title": "Weekly Clicks",
  "xAxis": { "dataKey": "week", "type": "datetime" },
  "yAxis": { "dataKey": "total_clicks", "label": "Clicks" },
  "series": [{ "dataKey": "total_clicks", "name": "Total Clicks" }],
  "legend": { "show": false }
}

Example 2 — Pie chart (data has columns: device_type, click_count):
{
  "chartType": "pie",
  "title": "Clicks by Device",
  "series": [],
  "chartConfig": { "type": "pie", "nameKey": "device_type", "valueKey": "click_count", "labelType": "percent" }
}

Example 3 — Bar chart (data has columns: country, revenue):
{
  "chartType": "bar",
  "title": "Revenue by Country",
  "xAxis": { "dataKey": "country", "type": "category" },
  "yAxis": { "dataKey": "revenue", "label": "Revenue" },
  "series": [{ "dataKey": "revenue", "name": "Revenue" }],
  "legend": { "show": false }
}

Example 4 — KPI (data has 1 row with column: total_revenue):
{
  "chartType": "kpi",
  "kpiValue": "total_revenue",
  "kpiLabel": "Total Revenue",
  "series": []
}

Example 5 — Heatmap (data has columns: country_code, week, click_count):
{
  "chartType": "heatmap",
  "title": "Clicks by Country and Week",
  "series": [],
  "chartConfig": { "type": "heatmap", "xKey": "week", "yKey": "country_code", "valueKey": "click_count", "colorScale": "blue" }
}

Respond with a single valid JSON object only. No markdown, no explanation, no code fences.`;

function buildUserMessage(
  intent: IntentObject,
  resultSet: ResultSet,
  semanticMd?: string,
): string {
  const sampleRows = resultSet.rows.slice(0, 10);

  const semanticSection = semanticMd
    ? `\nSemantic Layer (data model context — use column names from the Data Schema below, not from here):\n${semanticMd}\n`
    : "";

  return `Design a visualization for the following data:
${semanticSection}
Query Intent:
- Type: ${intent.queryType}
- Metrics: ${intent.metrics.join(", ")}
- Dimensions: ${intent.dimensions.join(", ")}
- Time Range: ${intent.timeRange ? `${intent.timeRange.start} to ${intent.timeRange.end}` : "not specified"}

Data Schema (use ONLY these exact column names in the spec):
${resultSet.columns.map((c) => `- ${c.name} (${c.type}${c.semanticRole ? `, role: ${c.semanticRole}` : ""})`).join("\n")}

Sample Data (first ${sampleRows.length} of ${resultSet.rowCount} rows):
${JSON.stringify(sampleRows, null, 2)}

Total rows: ${resultSet.rowCount}

Select the best chart type and configure the axes and series appropriately.`;
}

export async function planVisualization(
  input: VizPlannerInput,
): Promise<AgentResult<VisualizationSpec>> {
  const startedAt = new Date();
  const { context, intent, resultSet, semanticMd } = input;

  // For empty results, return a simple table
  if (resultSet.rowCount === 0) {
    return {
      data: {
        chartType: "table",
        title: "No data available",
        series: [],
      },
      trace: createSuccessTrace({
        agent: "viz_planner",
        model: context.fastModel,
        startedAt,
        inputTokens: 0,
        outputTokens: 0,
      }),
    };
  }

  // For single-row results, suggest KPI
  if (resultSet.rowCount === 1 && intent.metrics.length === 1) {
    const metricCol = resultSet.columns.find(
      (c) => c.semanticRole === "metric" || intent.metrics.includes(c.name),
    );
    if (metricCol) {
      return {
        data: {
          chartType: "kpi",
          kpiValue: metricCol.name,
          kpiLabel: metricCol.displayName ?? metricCol.name,
          series: [],
        },
        trace: createSuccessTrace({
          agent: "viz_planner",
          model: context.fastModel,
          startedAt,
          inputTokens: 0,
          outputTokens: 0,
        }),
      };
    }
  }

  try {
    const userMessage = buildUserMessage(intent, resultSet, semanticMd);

    const response = await context.client.messages.create({
      model: context.fastModel,
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
        "AGENT_ERROR",
        "No text response from viz planner",
        { agent: "viz_planner" },
      );
    }

    // Extract JSON from the response
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const validated = VisualizationSpecSchema.parse(parsed);

    const { inputTokens, outputTokens } = extractTokenUsage(response);

    return {
      data: validated,
      trace: createSuccessTrace({
        agent: "viz_planner",
        model: context.fastModel,
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
        agent: "viz_planner",
        model: context.fastModel,
        startedAt,
      },
      error instanceof Error ? error : new Error(String(error)),
    );

    throw new HeyDataError(
      "AGENT_ERROR",
      `Failed to plan visualization: ${error instanceof Error ? error.message : String(error)}`,
      { agent: "viz_planner", details: { trace } },
    );
  }
}
