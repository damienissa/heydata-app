import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Row, VisualizationSpec } from "@heydata/shared";

import { DataTable } from "../components/DataTable.js";

const mockData: Row[] = [
  { name: "Product A", sales: 1500, region: "North" },
  { name: "Product B", sales: 2300, region: "South" },
  { name: "Product C", sales: 1800, region: "East" },
];

describe("DataTable", () => {
  it("renders table with correct headers", () => {
    const spec: VisualizationSpec = {
      chartType: "table",
      title: "Sales Report",
      series: [
        { dataKey: "name", name: "Product" },
        { dataKey: "sales", name: "Sales" },
        { dataKey: "region", name: "Region" },
      ],
    };

    render(<DataTable spec={spec} data={mockData} />);

    expect(screen.getByText("Sales Report")).toBeInTheDocument();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
  });

  it("renders all data rows", () => {
    const spec: VisualizationSpec = {
      chartType: "table",
      series: [
        { dataKey: "name" },
        { dataKey: "sales" },
      ],
    };

    render(<DataTable spec={spec} data={mockData} />);

    expect(screen.getByText("Product A")).toBeInTheDocument();
    expect(screen.getByText("Product B")).toBeInTheDocument();
    expect(screen.getByText("Product C")).toBeInTheDocument();
  });

  it("includes xAxis column when provided", () => {
    const spec: VisualizationSpec = {
      chartType: "table",
      xAxis: { dataKey: "name", label: "Product Name" },
      series: [{ dataKey: "sales", name: "Sales" }],
    };

    render(<DataTable spec={spec} data={mockData} />);

    expect(screen.getByText("Product Name")).toBeInTheDocument();
  });

  it("shows pagination when data exceeds page size", () => {
    const largeData: Row[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      value: i * 100,
    }));

    const spec: VisualizationSpec = {
      chartType: "table",
      series: [
        { dataKey: "id", name: "ID" },
        { dataKey: "value", name: "Value" },
      ],
    };

    render(<DataTable spec={spec} data={largeData} pageSize={10} />);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
  });

  it("hides pagination when data fits in one page", () => {
    const spec: VisualizationSpec = {
      chartType: "table",
      series: [{ dataKey: "name" }],
    };

    render(<DataTable spec={spec} data={mockData} pageSize={10} />);

    expect(screen.queryByText("Page")).not.toBeInTheDocument();
  });
});
