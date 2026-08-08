# Universal AI Memory Vault

A provider-agnostic personal long-term memory layer for AI platforms. Claude, ChatGPT and other AIs read and write **one shared memory store** through the Model Context Protocol (MCP) — while **you** own the data, control access, and audit every change.

This project is a **memory storage + retrieval layer only**. It deliberately does **not** contain an AI chat, does **not** decide what to remember, and does **not** scrape browser sessions. Memory intelligence belongs to the calling AI.

---

## Architecture

```
┌──────────────┐   MCP (Streamable HTTP + OAuth)   ┌──────────────────────────────┐
│  Claude      │ ─────────────────────────────────▶ │                              │
│  ChatGPT     │ ─────────────────────────────────▶ │   Next.js 16 (this app)      │
│  Gemini CLI  │ ─────────────────────────────────▶ │   ├─ /api/mcp  (MCP server)  │
└──────────────┘                                    │   ├─ /api/oauth/* (AS)        │
                                                    │   ├─ /api/memories/* (REST)   │
┌──────────────┐          Browser (single user)    │   └─ Web dashboard            │
│  You (web)   │ ─────────────────────────────────▶ │                              │
└──────────────┘                                    └───────────────┬──────────────┘
                                                                    ▼
                                                    Supabase (Postgres + pgvector)
                                                    memories · memory_versions ·
                                                    audit_logs · ai_integrations ·
                                                    mcp_access_tokens · OAuth tables
```

- **Single user, no account system.** The platform has no login or signup — it is
  a private vault for one owner. All data is scoped to a fixed identity
  (`SINGLE_USER_ID` / `SINGLE_USER_EMAIL`, see `.env.example`).
- **Memory schema is vendor-neutral** — `fact`, `preference`, `habit`, `goal`, `life_event`, `relationship`, `worldview`, `project`, `temporary`, `other`. No `ChatGPTMemory`/`ClaudeMemory`/`GeminiMemory` variants.
- **Every mutation is versioned and audited.** `memory_update` bumps the version and snapshots old content; all actions are written to `audit_logs`.
- **SECURITY DEFINER RPC.** All data access goes through Postgres RPC functions (`memory_create`, `memory_update`, …) with an explicit `user_id` filter, called with the service-role key. Cross-user reads are impossible.
- **Memory is untrusted user data.** When memory is returned to an AI it is tagged `USER MEMORY — UNTRUSTED DATA` with an instruction to treat it as data. The server never executes memory content.
- **Honest compatibility matrix.** Anything not supported by a provider is marked `NOT CURRENTLY SUPPORTED` — no fake providers.

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres + pgvector) · MCP SDK v2 (`@modelcontextprotocol/server` 2.0.0, 2026-07-28 spec) · Zod 4 · Vitest.

## Getting started

### 1. Prerequisites

- Node.js 20+
- A Supabase project ([supabase.com](https://supabase.com)) with **Postgres** and the **pgvector** extension enabled
- (Optional) An OpenAI API key for vector embeddings

### 2. Install and configure

```bash
npm install
cp .env.example .env.local   # then fill in real values
```

Required env vars (see `.env.example` for the full list):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Never exposed to the browser |
| `SINGLE_USER_ID` / `SINGLE_USER_EMAIL` | Fixed owner identity (defaults in `.env.example`) |
| `NEXT_PUBLIC_APP_URL` | Public URL of this app (e.g. `https://you.example.com`) |
| `MCP_OAUTH_SECRET` | HMAC secret for OAuth access tokens (≥32 random chars) |
| `MCP_SERVER_URL` | Public MCP endpoint, usually `NEXT_PUBLIC_APP_URL` + `/api/mcp` |

### 3. Run the database migrations

```bash
# Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push

# or apply supabase/migrations/0001_init.sql, 0002_oauth.sql and
# 0003_remove_auth.sql manually in the Supabase SQL editor
# (enable the pgvector extension first).
```

### 4. Run

```bash
npm run dev        # http://localhost:3000
```

The app is a private single-user vault — no signup or login is needed. Open the
dashboard and connect an AI (see below).

## Connecting AI platforms

See [docs/provider-compatibility.md](docs/provider-compatibility.md) for the full, documentation-based capability matrix. Summary:

| Platform | Status |
| --- | --- |
| Claude (claude.ai) | **Supported** — custom remote MCP connector with OAuth (Free/Pro/Max/Team/Enterprise) |
| ChatGPT (chatgpt.com) | **Partial** — Developer Mode + remote MCP; write requires Business/Enterprise/Edu (beta) |
| Gemini (gemini.google.com) | **Not currently supported** — use the Gemini API / Gemini CLI / Enterprise instead |

## MCP tools exposed

| Tool | Description |
| --- | --- |
| `memory_search` | Ranked search of the user's long-term memory (semantic + lexical) |
| `memory_get` | Read one memory with full version history and audit trail |
| `memory_create` | Save a durable fact/preference/goal/…; supports conflict resolution via `supersedes` |
| `memory_update` | Update an existing memory (bumps version) |
| `memory_delete` | Delete a memory — requires explicit `confirm: "DELETE"` |

The MCP server authenticates via OAuth (authorization-code + PKCE, dynamic client registration, PAR, refresh-token rotation) or personal access tokens created in **Settings → Integrations**.

## REST API

See [docs/api.md](docs/api.md). Key endpoints:

- `GET/POST /api/memories` · `GET/PATCH/DELETE /api/memories/[id]` · `GET /api/memories/search`
- `GET /api/export` · `POST /api/import` · `POST /api/delete-all`
- `GET /api/integrations` · `GET/POST /api/access-tokens`
- `GET /api/health`

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest run (49 unit tests, no DB required)
npm run build       # production build
```

Tests run against an in-memory repository that mirrors the SQL semantics
(ownership isolation, versioning, hard delete, supersede, lexical search, audit
logging), so they need no database.

## Deploying

- **Vercel** — add the env vars above, deploy the repo. Serverless-friendly: no
  long-lived state, embeddings degrade to lexical search if OpenAI is missing.
- **Any Node host** — `npm run build && npm start`.
- **Supabase** — fully hosted; the app talks to it over HTTPS with the service-role key.

## Project structure

```
supabase/migrations/       SQL schema + SECURITY DEFINER RPC functions
src/app/                   App Router: pages + /api/* route handlers
src/components/            Client components
src/lib/                   Domain logic: types, validation, memory repo/service,
                           embeddings, JWT, OAuth authorization server, MCP tools
tests/                     Vitest unit tests
```

## Data ownership

Your memories are yours: **export** (`universal-memory.json`), **import**, and
**delete all** are first-class features in **Settings**. `memory_delete_all`
wipes every memory, version, audit log, integration and token for the owner.
