# REST API

The platform is single-user (no accounts, no login). Every endpoint acts on the
one owner's vault. There is no session cookie; the MCP resource server and
personal access tokens use a `Bearer` token.

Base URL: `<APP_URL>`

---

## Health

### `GET /api/health`  — public

```json
{
  "ok": true,
  "service": "universal-memory-vault",
  "time": "2026-08-08T00:00:00.000Z",
  "ready": true,
  "embedding_provider": "none"
}
```

---

## Memories

### `GET /api/memories` — list

Query params:

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | enum | — | fact, preference, habit, goal, life_event, relationship, worldview, project, temporary, other |
| `limit` | int 1–200 | 50 | |
| `offset` | int | 0 | |
| `sort` | enum | `updated` | updated, created, accessed |

Response: `{ "memories": [Memory…], "total": n }`

### `POST /api/memories` — create

```json
{
  "content": "User prefers dark mode",
  "type": "preference",
  "confidence": 0.9,
  "importance": 0.7,
  "source": "manual",
  "source_conversation_id": null,
  "meta": {},
  "supersedes": ["<uuid>"]
}
```

Response `201`: `{ "memory": MemoryDetail }`

### `GET /api/memories/[id]` — detail

Response: `{ "memory": MemoryDetail }` where `MemoryDetail` includes `versions`
(version history) and `audit` (audit trail). `404` if not found or not yours.

### `PATCH /api/memories/[id]` — update

Partial update. At least one of `content` / `type` / `confidence` / `importance`
/ `meta`. Changing `content` bumps the version number.

### `DELETE /api/memories/[id]` — delete

Requires a confirmation body:

```json
{ "confirm": "DELETE" }
```

Hard-deletes the memory (versions and audit history are kept). `400` without
`confirm`.

### `GET /api/memories/search` — semantic + lexical search

| Param | Type | Default |
| --- | --- | --- |
| `query` | string | `""` |
| `type` | enum | — |
| `limit` | int 1–20 | 8 |
| `min_importance` | 0–1 | 0 |

Response: `{ "results": [Memory & { score }…] }` — ranked best-match first.
Only `active` memories are returned.

---

## Export / Import / Erase

### `GET /api/export` — full backup

Downloads `universal-memory.json`:

```json
{
  "format": "universal-memory",
  "version": 1,
  "exported_at": "…",
  "count": 2,
  "items": [ExportItem…]
}
```

### `POST /api/import` — restore

Body: `{ "items": [ExportItem…] }` (or a bare array). Re-imports into the
vault. Response `{ "ok": true, "imported": n }`.

### `POST /api/delete-all` — erase everything

```json
{ "confirm": "DELETE_ALL" }
```

Response `{ "ok": true, "deleted": n }`. Deletes the requesting user's memories
only.

---

## Stats & audit

### `GET /api/stats` — dashboard stats

```json
{ "stats": { "total": 3, "by_type": { "fact": 2 }, "recent_memories": […], "recent_updates": […] } }
```

### `GET /api/audit-logs` — recent activity

| Param | Type | Default |
| --- | --- | --- |
| `limit` | int 1–200 | 50 |
| `memory_id` | uuid | — |

Response: `{ "entries": [{ action, source_provider, memory_id, detail, created_at }…] }`

---

## Integrations

### `GET /api/integrations` / `POST /api/integrations`

`POST` body: `{ "name": "Claude (claude.ai)", "provider": "claude", "meta": {} }`

### `DELETE /api/integrations/[id]`

---

## Access tokens

### `GET /api/access-tokens`

Returns masked tokens (`token_prefix`, never the secret).

### `POST /api/access-tokens`

```json
{ "name": "my-script", "provider": "other", "integration_id": null }
```

Response `201`: `{ "token": {…}, "secret": "umv_…" }` — the full secret is
returned **once**.

### `DELETE /api/access-tokens/[id]`

Revokes the token.

---

## OAuth 2.0 / MCP (public metadata)

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 AS metadata |
| `GET /.well-known/oauth-protected-resource` | RFC 9728 protected-resource metadata |
| `POST /api/oauth/register` | RFC 7591 dynamic client registration |
| `POST /api/oauth/par` | Pushed Authorization Requests |
| `GET|POST /api/oauth/authorize` | Authorization endpoint (consent page) |
| `POST /api/oauth/token` | Token endpoint (authorization_code / refresh_token) |
| `POST /api/oauth/revoke` | Token revocation |
| `POST /api/mcp` | MCP JSON-RPC (Streamable HTTP, 2026-07-28 spec) |

---

## Errors

Errors use HTTP status codes with a JSON body:

```json
{ "error": "unauthorized", "message": "Invalid access token" }
```

| Status | Meaning |
| --- | --- |
| 400 | Validation / confirmation required |
| 401 | Invalid or missing access token |
| 404 | Resource not found (or not owned by you) |
| 429 | Rate limit exceeded |
| 500 | Server error |

## Rate limiting

Per-user sliding window, default 120 requests/minute (configurable via
`RATE_LIMIT_RPM`; disable with `ENABLE_RATE_LIMIT=false`). Applies to all REST
endpoints.
