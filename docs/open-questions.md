# Hey Data — Open Questions

This document tracks unresolved architectural and product decisions.

---

## 1. Scope of v1 — RESOLVED (Phase 12-14)

**Question:** Start with a single domain (e.g., revenue analytics) or go broad from the beginning?

**Resolution:** Broad/universal approach. The semantic layer is auto-generated from any PostgreSQL schema via the semantic-generator agent (Phase 12). Users connect any database and get a semantic layer tailored to their schema. No domain-specific scoping.

---

## 2. User Personas — RESOLVED (Phase 3c, 14)

**Question:** Who are the primary users? (Executives, analysts, product managers?)

**Resolution:** The assistant-ui chat interface targets a broad audience — analysts, product managers, and technical users. The conversational UI is accessible to non-technical users while showing SQL and reasoning for power users (progressive trust). Semantic layer editing is available for analytics engineers.

---

## 3. Conversation Depth — RESOLVED (Phase 13)

**Question:** Simple Q&A only, or full analytical sessions with drill-downs and multi-turn refinement?

**Resolution:** Full analytical sessions. Multi-turn conversations with follow-up support are implemented in Phase 13. The intent resolver handles follow-up queries ("now break that down by region", "same but for Q3") by reusing and modifying the prior intent. Chat history is persisted in Supabase for session continuity.

---

## 4. Multi-Tenant — RESOLVED (Phase 10)

**Question:** Single team or multiple teams with different semantic layers?

**Resolution:** Multi-user with per-user isolation via Supabase Auth + Row Level Security (Phase 10). Each user has their own connections, semantic layers, and chat history. RLS policies on all tables ensure data isolation. Different users can have different semantic layers for the same database schema.

---

## 5. Feedback Loop — OPEN

**Question:** How do incorrect results feed back into improving the semantic layer?

**Current state:** Users can edit the semantic layer Markdown document directly (Phase 18c split-view editor), which addresses the "correct the system" use case. However, there is no explicit result-flagging UI or automated feedback pipeline from flagged results to semantic layer updates.

**Remaining work:**

- Add a "flag as incorrect" button on query results
- Log flagged results with full trace for review
- Consider AI-assisted suggestions for semantic layer corrections based on flagged patterns

---

## 6. Offline / Async — OPEN

**Question:** Should users be able to schedule recurring queries or receive alerts when metrics hit thresholds?

**Current state:** Deferred beyond current roadmap. The system is fully synchronous and conversational. Adding async/scheduled queries would require a job scheduling infrastructure (e.g., BullMQ + Redis) and a notification delivery system (email, Slack).

**Impact:** Does not affect current architecture decisions. Can be layered on top of the existing system as a separate phase.
