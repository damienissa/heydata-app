"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { RendererRouter } from "@heydata/renderer";
import type { Row, VisualizationSpec } from "@heydata/shared";

// ── Mock data ────────────────────────────────────────────────────────────────

const monthlyData: Row[] = [
  { month: "Jan", revenue: 42000, expenses: 28000, profit: 14000 },
  { month: "Feb", revenue: 48000, expenses: 30000, profit: 18000 },
  { month: "Mar", revenue: 45000, expenses: 32000, profit: 13000 },
  { month: "Apr", revenue: 53000, expenses: 29000, profit: 24000 },
  { month: "May", revenue: 61000, expenses: 35000, profit: 26000 },
  { month: "Jun", revenue: 58000, expenses: 33000, profit: 25000 },
];

const regionData: Row[] = [
  { region: "North America", revenue: 185000 },
  { region: "Europe", revenue: 142000 },
  { region: "Asia Pacific", revenue: 98000 },
  { region: "Latin America", revenue: 54000 },
  { region: "Middle East", revenue: 31000 },
];

const scatterData: Row[] = [
  { ad_spend: 5000, revenue: 32000, channel: "Email" },
  { ad_spend: 12000, revenue: 58000, channel: "Search" },
  { ad_spend: 8000, revenue: 41000, channel: "Social" },
  { ad_spend: 3000, revenue: 18000, channel: "Display" },
  { ad_spend: 15000, revenue: 72000, channel: "Influencer" },
  { ad_spend: 9000, revenue: 47000, channel: "Affiliate" },
  { ad_spend: 6000, revenue: 29000, channel: "Video" },
  { ad_spend: 20000, revenue: 95000, channel: "Paid Search" },
];

const funnelData: Row[] = [
  { stage: "Website Visitors", users: 50000 },
  { stage: "Signed Up", users: 12000 },
  { stage: "Activated", users: 5800 },
  { stage: "Paying Users", users: 1200 },
  { stage: "Retained (90d)", users: 820 },
];

const radarData: Row[] = [
  { metric: "Speed", productA: 85, productB: 62 },
  { metric: "Reliability", productA: 78, productB: 91 },
  { metric: "Scalability", productA: 92, productB: 70 },
  { metric: "UX", productA: 65, productB: 88 },
  { metric: "Cost", productA: 74, productB: 55 },
  { metric: "Support", productA: 80, productB: 83 },
];

const treemapData: Row[] = [
  { department: "Engineering", budget: 520000 },
  { department: "Sales", budget: 310000 },
  { department: "Marketing", budget: 240000 },
  { department: "Operations", budget: 180000 },
  { department: "HR", budget: 95000 },
  { department: "Finance", budget: 85000 },
];

const waterfallData: Row[] = [
  { item: "Gross Revenue", amount: 850000 },
  { item: "Refunds", amount: -42000 },
  { item: "Discounts", amount: -68000 },
  { item: "Net Revenue", amount: 740000 },
  { item: "COGS", amount: -310000 },
  { item: "Gross Profit", amount: 430000 },
  { item: "Operating Expenses", amount: -195000 },
  { item: "Net Profit", amount: 235000 },
];

const histogramData: Row[] = Array.from({ length: 120 }, (_, i) => ({
  response_time: Math.round(80 + Math.random() * 340 + (i % 7) * 12),
}));

const gaugeData: Row[] = [{ nps_score: 67 }];

const heatmapData: Row[] = [
  "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
].flatMap((day) =>
  ["6am", "9am", "12pm", "3pm", "6pm", "9pm"].map((hour) => ({
    day,
    hour,
    sessions: Math.round(20 + Math.random() * 280),
  }))
);

const kpiData: Row[] = [{ monthly_recurring_revenue: 284500 }];

const tableData: Row[] = [
  { order_id: "ORD-1001", customer: "Acme Corp", amount: 12400, status: "Delivered", date: "2024-06-01" },
  { order_id: "ORD-1002", customer: "Globex Inc", amount: 8750, status: "Processing", date: "2024-06-02" },
  { order_id: "ORD-1003", customer: "Initech", amount: 3200, status: "Shipped", date: "2024-06-03" },
  { order_id: "ORD-1004", customer: "Umbrella Ltd", amount: 21000, status: "Delivered", date: "2024-06-04" },
  { order_id: "ORD-1005", customer: "Stark Industries", amount: 95000, status: "Pending", date: "2024-06-05" },
  { order_id: "ORD-1006", customer: "Wayne Enterprises", amount: 44000, status: "Delivered", date: "2024-06-06" },
  { order_id: "ORD-1007", customer: "Dunder Mifflin", amount: 1850, status: "Cancelled", date: "2024-06-07" },
];

// ── Specs ────────────────────────────────────────────────────────────────────

const EXAMPLES: Array<{ label: string; prompt: string; spec: VisualizationSpec; data: Row[] }> = [
  {
    label: "Line Chart",
    prompt: "Show me monthly revenue, expenses, and profit as a line chart for the past 6 months.",
    data: monthlyData,
    spec: {
      chartType: "line",
      title: "Monthly Revenue vs Expenses",
      xAxis: { dataKey: "month" },
      yAxis: { dataKey: "revenue", label: "USD" },
      series: [
        { dataKey: "revenue", name: "Revenue", color: "#2563eb" },
        { dataKey: "expenses", name: "Expenses", color: "#dc2626" },
        { dataKey: "profit", name: "Profit", color: "#16a34a" },
      ],
    },
  },
  {
    label: "Bar Chart",
    prompt: "Compare monthly revenue and expenses side by side as a bar chart for the last 6 months.",
    data: monthlyData,
    spec: {
      chartType: "bar",
      title: "Monthly Revenue Breakdown",
      xAxis: { dataKey: "month" },
      yAxis: { dataKey: "revenue" },
      series: [
        { dataKey: "revenue", name: "Revenue", color: "#2563eb" },
        { dataKey: "expenses", name: "Expenses", color: "#dc2626" },
      ],
    },
  },
  {
    label: "Stacked Bar Chart",
    prompt: "Show me a stacked bar chart of expenses and profit per month to visualize the total cost composition.",
    data: monthlyData,
    spec: {
      chartType: "bar",
      title: "Monthly Cost Stack",
      xAxis: { dataKey: "month" },
      yAxis: { dataKey: "expenses" },
      stacked: true,
      series: [
        { dataKey: "expenses", name: "Expenses", color: "#dc2626", stackId: "a" },
        { dataKey: "profit", name: "Profit", color: "#16a34a", stackId: "a" },
      ],
    },
  },
  {
    label: "Area Chart",
    prompt: "Plot revenue and profit as an area chart over the last 6 months to show trends and overlap.",
    data: monthlyData,
    spec: {
      chartType: "area",
      title: "Revenue & Profit Over Time",
      xAxis: { dataKey: "month" },
      series: [
        { dataKey: "revenue", name: "Revenue", color: "#2563eb" },
        { dataKey: "profit", name: "Profit", color: "#16a34a" },
      ],
    },
  },
  {
    label: "Scatter Chart",
    prompt: "Is there a correlation between ad spend and revenue across marketing channels? Show it as a scatter plot.",
    data: scatterData,
    spec: {
      chartType: "scatter",
      title: "Ad Spend vs Revenue by Channel",
      xAxis: { dataKey: "ad_spend", label: "Ad Spend ($)" },
      yAxis: { dataKey: "revenue", label: "Revenue ($)" },
      series: [{ dataKey: "revenue", name: "Revenue" }],
    },
  },
  {
    label: "Composed Chart",
    prompt: "Show monthly revenue as bars and overlay profit as a line on the same chart.",
    data: monthlyData,
    spec: {
      chartType: "composed",
      title: "Revenue (Bar) + Profit (Line)",
      xAxis: { dataKey: "month" },
      yAxis: { dataKey: "revenue", label: "Revenue ($)" },
      series: [
        { dataKey: "revenue", name: "Revenue", type: "bar", color: "#2563eb" },
        { dataKey: "profit", name: "Profit", type: "line", color: "#16a34a" },
      ],
    },
  },
  {
    label: "Pie Chart",
    prompt: "What is the revenue breakdown by region? Show it as a pie chart.",
    data: regionData,
    spec: {
      chartType: "pie",
      title: "Revenue by Region",
      series: [],
      chartConfig: { type: "pie", nameKey: "region", valueKey: "revenue" },
    },
  },
  {
    label: "Donut Chart",
    prompt: "Show me the revenue share by region as a donut chart.",
    data: regionData,
    spec: {
      chartType: "donut",
      title: "Revenue Share by Region",
      series: [],
      chartConfig: { type: "donut", nameKey: "region", valueKey: "revenue" },
    },
  },
  {
    label: "Funnel Chart",
    prompt: "Show the user acquisition funnel from website visitors down to retained paying customers.",
    data: funnelData,
    spec: {
      chartType: "funnel",
      title: "User Acquisition Funnel",
      series: [],
      chartConfig: { type: "funnel", nameKey: "stage", valueKey: "users" },
    },
  },
  {
    label: "Radar Chart",
    prompt: "Compare Product A and Product B across speed, reliability, scalability, UX, cost, and support on a radar chart.",
    data: radarData,
    spec: {
      chartType: "radar",
      title: "Product A vs Product B",
      series: [
        { dataKey: "productA", name: "Product A", color: "#2563eb" },
        { dataKey: "productB", name: "Product B", color: "#dc2626" },
      ],
      chartConfig: { type: "radar", angleKey: "metric" },
    },
  },
  {
    label: "Treemap",
    prompt: "Show me a treemap of budget allocation across departments.",
    data: treemapData,
    spec: {
      chartType: "treemap",
      title: "Budget Allocation by Department",
      series: [],
      chartConfig: { type: "treemap", nameKey: "department", sizeKey: "budget" },
    },
  },
  {
    label: "Waterfall Chart",
    prompt: "Show a waterfall chart breaking down gross revenue into net profit step by step.",
    data: waterfallData,
    spec: {
      chartType: "waterfall",
      title: "P&L Waterfall",
      series: [],
      chartConfig: {
        type: "waterfall",
        categoryKey: "item",
        valueKey: "amount",
        totalLabel: "Net Profit",
      },
    },
  },
  {
    label: "Histogram",
    prompt: "What is the distribution of API response times? Show it as a histogram with 15 bins.",
    data: histogramData,
    spec: {
      chartType: "histogram",
      title: "API Response Time Distribution (ms)",
      series: [],
      chartConfig: { type: "histogram", valueKey: "response_time", binCount: 15 },
    },
  },
  {
    label: "Gauge",
    prompt: "Show our current Net Promoter Score as a gauge chart on a scale from 0 to 100.",
    data: gaugeData,
    spec: {
      chartType: "gauge",
      title: "Net Promoter Score",
      series: [],
      chartConfig: { type: "gauge", valueKey: "nps_score", min: 0, max: 100, unit: "" },
    },
  },
  {
    label: "Heatmap",
    prompt: "Show a heatmap of active user sessions by day of week and hour of day.",
    data: heatmapData,
    spec: {
      chartType: "heatmap",
      title: "Active Sessions by Day & Hour",
      series: [],
      chartConfig: { type: "heatmap", xKey: "hour", yKey: "day", valueKey: "sessions" },
    },
  },
  {
    label: "KPI Card",
    prompt: "What is our current Monthly Recurring Revenue? Show it as a KPI with comparison to last month.",
    data: kpiData,
    spec: {
      chartType: "kpi",
      title: "Monthly Recurring Revenue",
      kpiValue: "monthly_recurring_revenue",
      kpiComparison: "+18% vs last month",
      series: [],
    },
  },
  {
    label: "Data Table",
    prompt: "Show me the most recent orders with order ID, customer, amount, status, and date in a table.",
    data: tableData,
    spec: {
      chartType: "table",
      title: "Recent Orders",
      xAxis: { dataKey: "order_id" },
      series: [
        { dataKey: "order_id", name: "Order ID" },
        { dataKey: "customer", name: "Customer" },
        { dataKey: "amount", name: "Amount ($)" },
        { dataKey: "status", name: "Status" },
        { dataKey: "date", name: "Date" },
      ],
    },
  },
];

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Copy prompt"
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VisualizationsPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Visualization Gallery</h1>
          <p className="mt-2 text-muted-foreground">
            All supported chart types with example prompts you can copy and paste.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {EXAMPLES.map(({ label, prompt, spec, data }) => (
            <div
              key={label}
              className="overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <div className="border-b px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
              </div>

              <div className="p-4">
                <RendererRouter spec={spec} data={data} height={320} />
              </div>

              <div className="border-t bg-muted/30 px-4 py-3">
                <div className="flex items-start gap-3">
                  <p className="flex-1 text-sm text-muted-foreground italic leading-relaxed">
                    &ldquo;{prompt}&rdquo;
                  </p>
                  <CopyButton text={prompt} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
