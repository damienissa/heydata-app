# Hey Data — Open Questions

This document tracks unresolved architectural and product decisions. These should be answered before or during v1 implementation planning.

---

## 1. Scope of v1

**Question:** Start with a single domain (e.g., revenue analytics) or go broad from the beginning?

**Why it matters:**
- A narrow scope allows the semantic layer to be defined precisely and completely before launch
- A broad scope tests the system's generality earlier but increases the surface area for failures
- The answer affects how the semantic layer is structured and how many metric definitions are needed before the product is useful

---

## 2. User Personas

**Question:** Who are the primary users? (Executives, analysts, product managers?)

**Why it matters:**
- Executives want high-level summaries; analysts want drill-down and raw data access
- The Narrative Agent's tone and the UI's default verbosity should be tuned to the primary persona
- Access rules and what metrics are surfaced by default depend on who is using the system
- Determines whether the UI should lean purely conversational or support more dashboard-like features

---

## 3. Conversation Depth

**Question:** Simple Q&A only, or full analytical sessions with drill-downs and multi-turn refinement?

**Why it matters:**
- Full analytical sessions require robust conversation state management in the Orchestrator
- The Intent Resolver needs to correctly interpret follow-up queries in context ("same but for Q3", "now by region")
- Session depth affects context window management, caching strategy, and UI design
- Simple Q&A is significantly easier to build and test first

---

## 4. Multi-Tenant

**Question:** Single team or multiple teams with different semantic layers?

**Why it matters:**
- Multi-tenancy means different teams may have conflicting metric definitions (e.g., "revenue" means different things to Sales vs. Finance)
- Requires namespace isolation in the semantic layer, per-tenant access rules, and separate context management
- Single-tenant is much simpler to implement and reason about
- This decision shapes the entire data model of `@heydata/semantic`

---

## 5. Feedback Loop

**Question:** How do incorrect results feed back into improving the semantic layer?

**Why it matters:**
- User-flagged errors are a valuable signal, but acting on them requires a defined process
- Options range from manual review by analytics engineers to AI-assisted suggestions for updating metric definitions
- Without a feedback loop, the semantic layer will drift from business reality over time
- Affects observability requirements and what data needs to be captured per query

---

## 6. Offline / Async

**Question:** Should users be able to schedule recurring queries or receive alerts when metrics hit thresholds?

**Why it matters:**
- Async/scheduled queries require a job scheduling infrastructure that doesn't exist in the conversational model
- Alerts require threshold definitions and notification delivery (email, Slack, etc.)
- This is a significant scope expansion beyond the core conversational interface
- Could be deferred to v2 without affecting v1 architecture decisions
