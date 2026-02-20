# @heydata/renderer — Visualization Renderer

**Layer 6** in the Hey Data system.

---

## Role

Turn raw data and abstract visualization specifications into interactive charts, tables, and dashboards displayed to the user.

---

## Responsibilities

- Receive abstract visualization specifications from `@heydata/core` (Viz Planner Agent output)
- Interpret the spec and select the appropriate chart component
- Render the visualization using the configured chart library
- Apply formatting rules from the semantic layer (currency, decimals, date formats)
- Support interactive features: tooltips, drill-down, filtering, zoom
- Handle narrative text alongside visualizations
- Support all standard visualization types:
  - Line charts (time series, trends)
  - Bar charts (comparisons, rankings)
  - Scatter plots (correlations)
  - Heatmaps (density, two-dimensional distributions)
  - KPI cards (single-value summaries)
  - Data tables (raw results, detail views)
  - Small multiples (faceted views by dimension)
  - Dual-axis charts (two metrics with different scales)

---

## Key Design Decisions

- **Spec format:** Does the LLM generate a structured spec (e.g., Vega-Lite JSON) or actual component code (React/JSX)? A spec is more portable and safer; code is more flexible.
- **Chart library:** Pre-built component library (faster, constrained) vs. fully dynamic rendering (more flexible, more complex)?
- **Post-render interactivity:** How much can users interact with a rendered chart (filter, zoom, drill-down) without triggering a new LLM call? More interactivity without LLM calls improves responsiveness but requires more client-side logic.
- **Pinning / saving:** Can users pin a rendered visualization to a persistent canvas or export it?

---

## Interfaces

**Inputs from `@heydata/core` (via `@heydata/web`):**
- Abstract visualization specification:
  - Chart type
  - Data series mappings (which columns map to which axes)
  - Color scheme
  - Legend configuration
  - Label and formatting rules
  - Title and description
- Enriched result set (the actual data rows)
- Narrative text to display alongside the chart

**Outputs to `@heydata/web`:**
- Rendered, interactive chart component
- Formatted data table (optional, alongside or instead of chart)
- Export capability (PNG, CSV, etc.)
