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
}

const SYSTEM_PROMPT = `You are an expert data visualization designer. Given query results and user intent, select the optimal visualization.

DECISION TREE — apply in order, use the first match:
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

Chart type reference:
- "line": trends over time with continuous data
- "bar": comparisons across categories
- "area": cumulative data or volume over time
- "scatter": correlations between two metrics
- "composed": dual-axis charts with multiple metrics
- "kpi": single important metric (1 row returned)
- "table": many dimensions or detailed data needed
- "pie": parts of a whole (3-8 categories)
- "donut": same as pie with cleaner center space
- "funnel": sequential stages with drop-off
- "radar": comparing multiple dimensions of 2-3 items
- "treemap": hierarchical data proportions
- "waterfall": sequential positive/negative changes
- "histogram": distribution of a single numeric variable
- "gauge": single metric against a target/range (1 row, 1 metric)
- "heatmap": magnitude across two categorical dimensions

Configuration guidelines:
1. For time-series data, put the date dimension on the x-axis
2. Use appropriate axis labels and formats
3. For multiple metrics, use different colors or a composed chart with dual axes
4. Enable legend when multiple series exist
5. Consider stacking for related categories
6. For pie/donut charts, set chartConfig.nameKey to the category dimension and chartConfig.valueKey to the metric
7. For radar charts, set chartConfig.angleKey to the dimension and use series[] for each compared item
8. For waterfall charts, ensure data rows represent sequential changes; set chartConfig.totalLabel if a summary row exists
9. For histogram, set chartConfig.valueKey to the numeric column; the component will auto-bin the data
10. For gauge, use when result has 1 row and 1 metric; set chartConfig.min/max/target as appropriate
11. For heatmap, requires two categorical dimensions and one numeric measure
12. For treemap, set chartConfig.nameKey to the label and chartConfig.sizeKey to the numeric value

Respond with a JSON object matching the VisualizationSpec schema:
{
  "chartType": "line" | "bar" | "area" | "scatter" | "composed" | "kpi" | "table" | "pie" | "donut" | "funnel" | "radar" | "treemap" | "waterfall" | "histogram" | "gauge" | "heatmap",
  "title": "Optional chart title",
  "xAxis": {
    "dataKey": "column name",
    "label": "Axis label",
    "type": "category" | "number" | "datetime",
    "format": "format string (optional)"
  },
  "yAxis": {
    "dataKey": "column name for primary y-axis",
    "label": "Axis label",
    "type": "number"
  },
  "yAxisRight": { // Optional, for dual-axis charts
    "dataKey": "column name",
    "label": "Axis label",
    "type": "number"
  },
  "series": [
    {
      "dataKey": "column name",
      "name": "Display name",
      "color": "hex color (optional)",
      "type": "line" | "bar" | "area" (optional, for composed charts),
      "yAxisId": "left" | "right" (optional),
      "stackId": "stack group id (optional)"
    }
  ],
  "legend": {
    "show": true | false,
    "position": "top" | "bottom" | "left" | "right"
  },
  "stacked": true | false (optional),
  "kpiValue": "column name for KPI value (when chartType is kpi)",
  "kpiLabel": "Label for KPI (when chartType is kpi)",
  "kpiComparison": "column name for comparison value (optional)",
  "chartConfig": { // Required for: pie, donut, funnel, radar, treemap, waterfall, histogram, gauge, heatmap
    "type": "must match chartType",
    // Pie/Donut: "nameKey", "valueKey", "innerRadius" (optional), "labelType": "value"|"percent"|"name"|"none" (optional)
    // Funnel: "nameKey", "valueKey", "reversed" (optional)
    // Radar: "angleKey", "radiusLabel" (optional)
    // Treemap: "nameKey", "sizeKey", "colorKey" (optional)
    // Waterfall: "categoryKey", "valueKey", "totalLabel" (optional), "positiveColor" (optional), "negativeColor" (optional)
    // Histogram: "valueKey", "binCount" (optional, default 10)
    // Gauge: "valueKey", "min", "max", "target" (optional), "unit" (optional)
    // Heatmap: "xKey", "yKey", "valueKey", "colorScale": "blue"|"green"|"red"|"diverging" (optional), "showValues" (optional)
  }
}`;

function buildUserMessage(
  intent: IntentObject,
  resultSet: ResultSet,
): string {
  const sampleRows = resultSet.rows.slice(0, 10);

  return `Design a visualization for the following data:

Query Intent:
- Type: ${intent.queryType}
- Metrics: ${intent.metrics.join(", ")}
- Dimensions: ${intent.dimensions.join(", ")}
- Time Range: ${intent.timeRange ? `${intent.timeRange.start} to ${intent.timeRange.end}` : "not specified"}

Data Schema:
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
  const { context, intent, resultSet } = input;

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
        model: context.model,
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
          model: context.model,
          startedAt,
          inputTokens: 0,
          outputTokens: 0,
        }),
      };
    }
  }

  try {
    const userMessage = buildUserMessage(intent, resultSet);

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
        agent: "viz_planner",
        model: context.model,
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
