import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Row, VisualizationSpec } from "@heydata/shared";

import { KpiCard } from "../components/KpiCard.js";

describe("KpiCard", () => {
  it("renders title and formatted value", () => {
    const spec: VisualizationSpec = {
      chartType: "kpi",
      title: "Total Users",
      kpiValue: "count",
      series: [],
    };
    const data: Row[] = [{ count: 1500000 }];

    render(<KpiCard spec={spec} data={data} />);

    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("1.5M")).toBeInTheDocument();
  });

  it("renders KPI label when provided", () => {
    const spec: VisualizationSpec = {
      chartType: "kpi",
      title: "Revenue",
      kpiValue: "revenue",
      kpiLabel: "USD",
      series: [],
    };
    const data: Row[] = [{ revenue: 50000 }];

    render(<KpiCard spec={spec} data={data} />);

    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("renders positive comparison with green styling", () => {
    const spec: VisualizationSpec = {
      chartType: "kpi",
      title: "Revenue",
      kpiValue: "revenue",
      kpiComparison: "+15% vs last month",
      series: [],
    };
    const data: Row[] = [{ revenue: 25000 }];

    render(<KpiCard spec={spec} data={data} />);

    const comparison = screen.getByText("+15% vs last month");
    expect(comparison).toBeInTheDocument();
    expect(comparison.parentElement).toHaveClass("text-green-600");
  });

  it("renders negative comparison with red styling", () => {
    const spec: VisualizationSpec = {
      chartType: "kpi",
      title: "Revenue",
      kpiValue: "revenue",
      kpiComparison: "-8% vs last month",
      series: [],
    };
    const data: Row[] = [{ revenue: 18000 }];

    render(<KpiCard spec={spec} data={data} />);

    const comparison = screen.getByText("-8% vs last month");
    expect(comparison).toBeInTheDocument();
    expect(comparison.parentElement).toHaveClass("text-red-600");
  });

  it("handles null/undefined values gracefully", () => {
    const spec: VisualizationSpec = {
      chartType: "kpi",
      title: "Missing Data",
      kpiValue: "missing_key",
      series: [],
    };
    const data: Row[] = [{ other_key: 100 }];

    render(<KpiCard spec={spec} data={data} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("formats billion values correctly", () => {
    const spec: VisualizationSpec = {
      chartType: "kpi",
      title: "Market Cap",
      kpiValue: "value",
      series: [],
    };
    const data: Row[] = [{ value: 2500000000 }];

    render(<KpiCard spec={spec} data={data} />);

    expect(screen.getByText("2.5B")).toBeInTheDocument();
  });
});
