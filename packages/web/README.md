# @heydata/web — User Interface

**Layer 1** in the Hey Data system.

---

## Role

Capture user intent and render results. The entry point for all user interactions with Hey Data.

---

## Responsibilities

- Provide a chat-based input interface for users to ask analytical questions in natural language
- Maintain a canvas/output area that renders dynamic visualizations, tables, and narrative summaries returned by `@heydata/renderer`
- Support follow-up questions and conversational refinements ("now break that down by region", "make it a bar chart")
- Maintain conversation context across a session (history of queries and responses)
- Forward user queries plus session context to `@heydata/core`
- Display generated SQL and metric definitions to users who opt into the transparency toggle
- Handle loading states and error messages gracefully during processing

---

## Key Design Decisions

- **Pure conversational vs. hybrid:** Should the UI be purely chat-based, or should it also support pinning generated visualizations to a persistent dashboard-like canvas?
- **Visualization control:** How much control does the user have over the output format? Can they explicitly request a specific chart type, or is that entirely up to the Viz Planner Agent?
- **Save and share:** Can users save or share generated views? If so, what is the persistence model?
- **Transparency defaults:** Should the generated SQL and metric definitions be visible by default, or hidden behind an optional toggle for power users?

---

## Interfaces

**Sends to `@heydata/core`:**
- User message (string)
- Conversation history (array of prior turns)
- Session context (user identity, active session state)

**Receives from `@heydata/core`:**
- Visualization specification (passed to `@heydata/renderer`)
- Enriched result set (passed to `@heydata/renderer`)
- Narrative text
- Generated SQL (for transparency display)
- Metric definitions used (for transparency display)
- Error messages and clarification requests

**Renders via `@heydata/renderer`:**
- Interactive charts and data tables
- Narrative summaries
