-- Phase 18: Replace structured JSONB semantic layer with a single Markdown document
--
-- Drop the rigid metrics/dimensions/entities JSONB columns and replace them with
-- a single semantic_md TEXT column that stores a human-readable Markdown document.
-- This document is auto-generated from the database schema and freely editable
-- by users to add domain knowledge, business rules, and custom context.

ALTER TABLE public.semantic_layers
  DROP COLUMN IF EXISTS metrics,
  DROP COLUMN IF EXISTS dimensions,
  DROP COLUMN IF EXISTS entities;

ALTER TABLE public.semantic_layers
  ADD COLUMN IF NOT EXISTS semantic_md TEXT NOT NULL DEFAULT '';
