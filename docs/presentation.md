# Hey Data — Presentation Script & Screen Frames

> **Total duration:** ~2:30–3:00
> **Speaking pace:** ~150 words/min
> **Format:** Each section has a time range, screen frame description, and voiceover script

---

## [0:00 – 0:15] Opening — The Problem

**Screen:** Dark slide with a split visual — left side shows a tangled mess of SQL queries, dashboard builders, and BI tool logos fading out; right side shows a clean chat interface with a blinking cursor. Title fades in: **"Hey Data — Talk to Your Database"**

**Voiceover:**

> Every company sits on a goldmine of data. But getting answers still means writing SQL, building dashboards, or waiting for an analyst. What if you could just *ask* your database a question — in plain English — and get an instant, visual answer?

---

## [0:15 – 0:35] What is Hey Data

**Screen:** Animated product demo — show the chat interface. A user types: *"What were our top 10 products by revenue last quarter?"* The AI responds with a bar chart and a narrative summary. Highlight the slash-command picker appearing as the user types `/`.

**Voiceover:**

> Meet Hey Data — a conversational analytics platform for PostgreSQL. Instead of dashboards, you get a chat. Type a question, and our AI agent pipeline translates it into SQL, executes it safely against your database, and returns interactive charts with human-readable insights. You can even use auto-generated slash commands like `/top-products` or `/monthly-revenue` for your most common queries.

---

## [0:35 – 1:05] How It Works — The AI Pipeline

**Screen:** Animated architecture diagram showing the 9-agent pipeline as a horizontal flow. Each agent lights up in sequence: Intent Resolver → SQL Generator → SQL Validator → Query Execution → Data Validator → (fork) Data Analyzer + Viz Planner (in parallel) → Narrative. Show retry loops between Validator and Generator with arrows. Display model badges: "Claude Haiku — fast" on each agent.

**Voiceover:**

> Under the hood, Hey Data runs a multi-agent AI pipeline powered by Anthropic's Claude. When you ask a question, nine specialized agents work in sequence. First, your intent is parsed. Then SQL is generated using a semantic layer — a document that describes your database in business terms. The query is validated, executed, and the results are checked. Next, two agents run in parallel — one analyzes the data for insights, the other picks the best chart type. Finally, a narrative agent writes a plain-English summary. If anything goes wrong, built-in retry loops self-correct — up to three attempts — before asking for help.

---

## [1:05 – 1:30] The Semantic Layer & Onboarding

**Screen:** Show the onboarding wizard — 4 steps: Connect → Introspect → Generate → Done. Then transition to the split-view semantic editor showing Markdown on the left and a preview on the right. Highlight that it's auto-generated but fully editable.

**Voiceover:**

> Getting started takes minutes. Our onboarding wizard connects to your PostgreSQL database, introspects the schema, and auto-generates a semantic layer — a Markdown document that maps your tables and columns to business concepts. This is what makes the AI understand that `txn_amt` means "transaction amount" or `cust_id` means "customer." You can edit it anytime to fine-tune how the AI interprets your data.

---

## [1:30 – 1:55] Visualization & Chart Types

**Screen:** Grid showcase of all 16 chart types — quickly cycle through: Line, Bar, Area, Scatter, Pie, Donut, Funnel, Radar, Treemap, Waterfall, Histogram, Gauge, Heatmap, Composed (dual-axis), KPI Card, and Data Table. Each appears for ~1 second with sample data. End on a composed chart with a narrative card below it.

**Voiceover:**

> The AI doesn't just return raw numbers. It picks from sixteen visualization types — from simple bar charts to heatmaps, waterfall charts, gauges, and dual-axis composed views. Each chart is interactive and rendered in real-time. For tabular data, there's a full-featured data table with sorting and pagination. Every response also includes a narrative — a short, readable summary so you understand the "so what" behind the data.

---

## [1:55 – 2:20] Security & Architecture

**Screen:** Architecture diagram showing the 8-layer stack as concentric rings or vertical layers. Highlight security badges at each layer: "AES-256-GCM Encryption" on the connection layer, "Row Level Security" on Supabase, "Read-Only SQL Guards" on the bridge, "Server-Side API Keys" on the core. Show the monorepo package structure on the side.

**Voiceover:**

> Security is built into every layer. Connection strings are encrypted with AES-256-GCM at rest. All database queries are strictly read-only — we block any destructive SQL before it reaches your database. Row-level security ensures complete data isolation between users. API keys never touch the client. The entire platform is built as a TypeScript monorepo — seven packages, each with a single responsibility — powered by Next.js, Supabase, and the Vercel AI SDK.

---

## [2:20 – 2:45] Closing — Vision & Call to Action

**Screen:** Return to the chat interface — show a rapid montage of different questions being asked and answered: revenue trends, customer segments, product performance, funnel analysis. End with the Hey Data logo centered, tagline below: **"Your data has answers. Just ask."** Contact/demo link at the bottom.

**Voiceover:**

> Hey Data turns every team member into a data analyst. No SQL. No dashboards. No waiting. Just ask a question and get an answer — with charts, insights, and context — in seconds. Whether you're in product, marketing, finance, or ops — your data is finally accessible. Hey Data. Your data has answers. Just ask.

---

## Summary Table

| Time | Section | Screen Frame | Duration |
|------|---------|-------------|----------|
| 0:00–0:15 | The Problem | Split visual: SQL mess vs clean chat UI | 15s |
| 0:15–0:35 | What is Hey Data | Live product demo — chat + slash commands | 20s |
| 0:35–1:05 | AI Pipeline | 9-agent architecture diagram (animated) | 30s |
| 1:05–1:30 | Semantic Layer & Onboarding | Onboarding wizard + semantic editor | 25s |
| 1:30–1:55 | Visualizations | 16 chart type showcase grid | 25s |
| 1:55–2:20 | Security & Architecture | 8-layer stack + security badges | 25s |
| 2:20–2:45 | Closing & CTA | Chat montage → logo + tagline | 25s |
| | **Total** | | **~2:45** |

---

## Production Notes

- **Speaking pace:** Keep it steady at ~150 wpm. Pause briefly between sections for slide transitions.
- **Tone:** Confident, conversational, slightly energetic. Not overly salesy — let the product speak.
- **Music:** Light, modern background track. Subtle tech/ambient feel. Lower during voiceover, swell slightly during transitions and closing.
- **Transitions:** Smooth crossfades between sections. Use motion graphics for the pipeline and architecture diagrams.
