import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Row, VisualizationSpec } from "@heydata/shared";

import { RendererRouter } from "../RendererRouter.js";

const mockData: Row[] = [
  { date: "2024-01", revenue: 10000, orders: 150 },
  { date: "2024-02", revenue: 12000, orders: 180 },
  { date: "2024-03", revenue: 11500, orders: 165 },
];

describe("RendererRouter", () => {
  it("renders line chart when chartType is line", () => {
    const spec: VisualizationSpec = {
      chartType: "line",
      title: "Revenue Trend",
      xAxis: { dataKey: "date" },
      yAxis: { dataKey: "revenue" },
      series: [{ dataKey: "revenue", name: "Revenue" }],
    };

    render(<RendererRouter spec={spec} data={mockData} />);

    expect(screen.getByText("Revenue Trend")).toBeInTheDocument();
  });

  it("renders bar chart when chartType is bar", () => {
    const spec: VisualizationSpec = {
      chartType: "bar",
      title: "Monthly Orders",
      xAxis: { dataKey: "date" },
      yAxis: { dataKey: "orders" },
      series: [{ dataKey: "orders", name: "Orders" }],
    };

    render(<RendererRouter spec={spec} data={mockData} />);

    expect(screen.getByText("Monthly Orders")).toBeInTheDocument();
  });

  it("renders area chart when chartType is area", () => {
    const spec: VisualizationSpec = {
      chartType: "area",
      title: "Cumulative Revenue",
      xAxis: { dataKey: "date" },
      series: [{ dataKey: "revenue" }],
    };

    render(<RendererRouter spec={spec} data={mockData} />);

    expect(screen.getByText("Cumulative Revenue")).toBeInTheDocument();
  });

  it("renders kpi card when chartType is kpi", () => {
    const kpiData: Row[] = [{ total_revenue: 33500 }];
    const spec: VisualizationSpec = {
      chartType: "kpi",
      title: "Total Revenue",
      kpiValue: "total_revenue",
      kpiComparison: "+12% vs last quarter",
      series: [],
    };

    render(<RendererRouter spec={spec} data={kpiData} />);

    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("33.5K")).toBeInTheDocument();
  });

  it("renders data table when chartType is table", () => {
    const spec: VisualizationSpec = {
      chartType: "table",
      title: "Sales Data",
      xAxis: { dataKey: "date" },
      series: [
        { dataKey: "revenue", name: "Revenue" },
        { dataKey: "orders", name: "Orders" },
      ],
    };

    render(<RendererRouter spec={spec} data={mockData} />);

    expect(screen.getByText("Sales Data")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  it("renders pie chart when chartType is pie", () => {
    const pieData: Row[] = [
      { region: "US", revenue: 5000 },
      { region: "EU", revenue: 3000 },
      { region: "APAC", revenue: 2000 },
    ];
    const spec: VisualizationSpec = {
      chartType: "pie",
      title: "Revenue by Region",
      series: [],
      chartConfig: { type: "pie", nameKey: "region", valueKey: "revenue" },
    };

    render(<RendererRouter spec={spec} data={pieData} />);

    expect(screen.getByText("Revenue by Region")).toBeInTheDocument();
  });

  it("renders donut chart when chartType is donut", () => {
    const donutData: Row[] = [
      { category: "A", share: 40 },
      { category: "B", share: 35 },
      { category: "C", share: 25 },
    ];
    const spec: VisualizationSpec = {
      chartType: "donut",
      title: "Market Share",
      series: [],
      chartConfig: { type: "donut", nameKey: "category", valueKey: "share" },
    };

    render(<RendererRouter spec={spec} data={donutData} />);

    expect(screen.getByText("Market Share")).toBeInTheDocument();
  });

  it("renders funnel chart when chartType is funnel", () => {
    const funnelData: Row[] = [
      { stage: "Visitors", count: 10000 },
      { stage: "Signups", count: 5000 },
      { stage: "Purchases", count: 1000 },
    ];
    const spec: VisualizationSpec = {
      chartType: "funnel",
      title: "Conversion Funnel",
      series: [],
      chartConfig: { type: "funnel", nameKey: "stage", valueKey: "count" },
    };

    render(<RendererRouter spec={spec} data={funnelData} />);

    expect(screen.getByText("Conversion Funnel")).toBeInTheDocument();
  });

  it("renders radar chart when chartType is radar", () => {
    const radarData: Row[] = [
      { skill: "Speed", productA: 80, productB: 60 },
      { skill: "Accuracy", productA: 70, productB: 90 },
      { skill: "Power", productA: 95, productB: 75 },
    ];
    const spec: VisualizationSpec = {
      chartType: "radar",
      title: "Product Comparison",
      series: [
        { dataKey: "productA", name: "Product A" },
        { dataKey: "productB", name: "Product B" },
      ],
      chartConfig: { type: "radar", angleKey: "skill" },
    };

    render(<RendererRouter spec={spec} data={radarData} />);

    expect(screen.getByText("Product Comparison")).toBeInTheDocument();
  });

  it("renders treemap chart when chartType is treemap", () => {
    const treemapData: Row[] = [
      { department: "Engineering", budget: 500000 },
      { department: "Marketing", budget: 300000 },
      { department: "Sales", budget: 200000 },
    ];
    const spec: VisualizationSpec = {
      chartType: "treemap",
      title: "Budget by Department",
      series: [],
      chartConfig: { type: "treemap", nameKey: "department", sizeKey: "budget" },
    };

    render(<RendererRouter spec={spec} data={treemapData} />);

    expect(screen.getByText("Budget by Department")).toBeInTheDocument();
  });

  it("renders waterfall chart when chartType is waterfall", () => {
    const waterfallData: Row[] = [
      { item: "Revenue", amount: 50000 },
      { item: "COGS", amount: -20000 },
      { item: "Expenses", amount: -15000 },
      { item: "Net Profit", amount: 15000 },
    ];
    const spec: VisualizationSpec = {
      chartType: "waterfall",
      title: "Profit Breakdown",
      series: [],
      chartConfig: { type: "waterfall", categoryKey: "item", valueKey: "amount", totalLabel: "Net Profit" },
    };

    render(<RendererRouter spec={spec} data={waterfallData} />);

    expect(screen.getByText("Profit Breakdown")).toBeInTheDocument();
  });

  it("renders histogram chart when chartType is histogram", () => {
    const histData: Row[] = Array.from({ length: 50 }, (_, i) => ({ age: 20 + Math.floor(i * 0.8) }));
    const spec: VisualizationSpec = {
      chartType: "histogram",
      title: "Age Distribution",
      series: [],
      chartConfig: { type: "histogram", valueKey: "age", binCount: 10 },
    };

    render(<RendererRouter spec={spec} data={histData} />);

    expect(screen.getByText("Age Distribution")).toBeInTheDocument();
  });

  it("renders gauge chart when chartType is gauge", () => {
    const gaugeData: Row[] = [{ completion: 73 }];
    const spec: VisualizationSpec = {
      chartType: "gauge",
      title: "Completion Rate",
      series: [],
      chartConfig: { type: "gauge", valueKey: "completion", min: 0, max: 100, unit: "%" },
    };

    render(<RendererRouter spec={spec} data={gaugeData} />);

    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
  });

  it("renders heatmap chart when chartType is heatmap", () => {
    const heatmapData: Row[] = [
      { day: "Mon", hour: "9am", activity: 50 },
      { day: "Mon", hour: "10am", activity: 80 },
      { day: "Tue", hour: "9am", activity: 30 },
      { day: "Tue", hour: "10am", activity: 90 },
    ];
    const spec: VisualizationSpec = {
      chartType: "heatmap",
      title: "Activity Heatmap",
      series: [],
      chartConfig: { type: "heatmap", xKey: "hour", yKey: "day", valueKey: "activity" },
    };

    render(<RendererRouter spec={spec} data={heatmapData} />);

    expect(screen.getByText("Activity Heatmap")).toBeInTheDocument();
  });
});
