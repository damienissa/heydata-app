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

Chart type guidelines:
- "line": Best for trends over time with continuous data
- "bar": Best for comparisons across categories
- "area": Best for cumulative data or showing volume over time
- "scatter": Best for showing correlations between two metrics
- "composed": Best for dual-axis charts with multiple metrics
- "kpi": Best for single important metrics (use when only 1 row returned)
- "table": Best when there are many dimensions or detailed data is needed

Configuration guidelines:
1. For time-series data, put the date dimension on the x-axis
2. Use appropriate axis labels and formats
3. For multiple metrics, use different colors or a composed chart with dual axes
4. Enable legend when multiple series exist
5. Consider stacking for related categories

Respond with a JSON object matching the VisualizationSpec schema:
{
  "chartType": "line" | "bar" | "area" | "scatter" | "composed" | "kpi" | "table",
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
      "type": "line" | "bar" | "area" (optional),
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
  "kpiComparison": "column name for comparison value (optional)"
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
