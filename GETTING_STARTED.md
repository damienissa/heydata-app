# Getting Started with HeyData

This guide walks you through setting up HeyData locally and connecting your first database.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        @heydata/web                             │
│  Next.js app with chat UI and visualization components          │
└─────────────────────────────────────────────────────────────────┘
                    │                   │
                    ▼                   ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│     @heydata/core       │   │   @heydata/supabase     │
│  AI Agent Pipeline      │   │   Auth + Metadata Store  │
└───────────┬─────────────┘   └─────────────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌──────────┐  ┌──────────────┐
│@heydata/ │  │@heydata/     │
│ semantic │  │   bridge     │
│(Markdown │  │(DB Adapter + │
│  store)  │  │ SQL guards)  │
└──────────┘  └──────┬───────┘
                     ▼
              ┌─────────────────────┐
              │  Your Database      │
              │  (PostgreSQL)       │
              └─────────────────────┘
```

---

## Step 1: Environment Setup

### 1.1 Install Dependencies

```bash
pnpm install
```

### 1.2 Create Environment File

Create `packages/web/.env.local`:

```env
# Required: Anthropic API key for AI agents
ANTHROPIC_API_KEY=sk-ant-api03-...

# Required: Supabase project credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required: Encryption key for connection strings (64 hex chars / 32 bytes)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CONNECTION_STRING_ENCRYPTION_KEY=your-64-char-hex-key
```

### 1.3 Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings** → **API** to find your URL and keys
3. Apply database migrations:

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Run SQL files manually in the Supabase SQL Editor
# Apply each file in supabase/migrations/ in order
```

---

## Step 2: Build & Run

### 2.1 Build All Packages

```bash
pnpm build
```

### 2.2 Start Development Server

```bash
pnpm dev
```

### 2.3 Open the App

Go to [http://localhost:3000](http://localhost:3000).

---

## Step 3: Connect Your Database

HeyData uses an onboarding wizard to connect and configure your database automatically.

1. **Sign up** — Create an account at the login page
2. **Add connection** — You'll be redirected to `/setup`. Enter your PostgreSQL connection string
3. **Auto-introspect** — HeyData queries `information_schema` to discover your tables, columns, and relationships
4. **Auto-generate semantic layer** — An AI agent analyzes your schema and generates a Markdown document describing your metrics, dimensions, and entities
5. **Generate slash commands** — AI creates `/commandName` shortcuts based on your semantic layer
6. **Start chatting** — Ask questions in natural language

The semantic layer is a human-readable Markdown document stored in Supabase. You can edit it anytime via the **Semantic Layer** settings page (book icon in the connection manager).

---

## Step 4: Ask Questions

Try asking:

- "Show me revenue for the last 30 days"
- "What's our average order value by region?"
- "Compare this month's sales to last month"

You can also use slash commands (type `/` in the chat) for quick access to common queries.

---

## Troubleshooting

### "Connection failed" Error

Database connection issues. Check:

1. Connection string is correct (host, port, database, user, password)
2. Your database allows external connections
3. SSL is configured correctly (Supabase requires SSL)
4. Your IP is allowlisted if the database has IP restrictions

### "Query timeout" Error

Query is too slow. Consider:

1. Add indexes to frequently queried columns
2. Check if your tables are very large (millions of rows)

### Incorrect or Unexpected Results

The AI may misinterpret your question or your schema. Try:

1. Rephrase your question with more specific terms
2. Edit the semantic layer to add domain knowledge and clarify metric definitions
3. Check that table/column descriptions in the semantic layer match your schema

---

## Command Reference

```bash
# Development
pnpm dev              # Start dev server (all packages)
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # Check TypeScript
pnpm lint             # Run ESLint

# Individual packages
pnpm --filter @heydata/core test
pnpm --filter @heydata/semantic build
pnpm --filter @heydata/bridge typecheck
```
