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
});
