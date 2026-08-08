# AI Platform Compatibility Matrix

This is an **honest, documentation-based** capability matrix for connecting this
Universal Memory Vault to each AI platform. Anything marked
`NOT CURRENTLY SUPPORTED` is genuinely unsupported — this project never fakes
compatibility and never scrapes browser sessions.

Research was done against official vendor documentation (cut-off: 2026).

---

## Claude (claude.ai)

**Status: SUPPORTED** — the primary, fully-supported integration.

| Capability | Value |
| --- | --- |
| Mechanism | Custom **remote MCP connector** |
| Auth | OAuth 2.0 (authorization-code + PKCE) — fully supported |
| Plans | Free, Pro, Max, Team, Enterprise all support custom connectors |
| Free-tier limit | 1 custom connector |
| Team/Enterprise note | Connector must be added by the workspace **Owner** |
| Tool access | Read/write memory tools |

**To connect:** create the MCP server with URL `<APP_URL>/api/mcp` (or the
value of `MCP_SERVER_URL`). Claude will discover the OAuth Authorization Server
via the RFC 9728 protected-resource metadata at
`<APP_URL>/.well-known/oauth-protected-resource` and run the consent flow.

Source: Anthropic / Claude support documentation on MCP connector support
(`support.claude.com`), verified during research.

---

## ChatGPT (chatgpt.com)

**Status: PARTIAL** — works, with plan-dependent caveats.

| Capability | Value |
| --- | --- |
| Mechanism | Developer Mode → **remote MCP server** |
| Auth | OAuth 2.0 with authorization-code + PKCE |
| Free plan | Remote MCP servers require Developer Mode |
| Plus / Pro | Remote MCP servers are **read-only** (write is being rolled out) |
| Business / Enterprise / Edu | **Full read + write** (beta, requires the admin to enable) |
| Tool access | Depends on plan (see above) |

**To connect:** enable Developer Mode, then add a remote MCP server with URL
`<APP_URL>/api/mcp`.

Source: OpenAI developer documentation on MCP support in ChatGPT
(`developers.openai.com`), verified during research.

---

## Gemini (gemini.google.com)

**Status: NOT CURRENTLY SUPPORTED** (personal web version).

| Capability | Value |
| --- | --- |
| gemini.google.com (personal) | **No self-serve remote MCP** — a personal Gemini account cannot point at a custom MCP server today |
| Gemini API Managed Agents | Supports remote MCP servers (for API users) |
| Gemini CLI | Supports MCP servers (developer tool) |
| Gemini Enterprise (Workspace) | Google Workspace admins can enable MCP in Chat (enterprise feature) |

**Impact:** for the personal web product this memory vault is explicitly
documented as **NOT SUPPORTED**. We do not scrape or emulate the Gemini web
session. If you use the Gemini API / Gemini CLI, you can still connect to the
same MCP server over OAuth or a personal access token.

Source: Google Gemini / MCP documentation (Gemini API Managed Agents, Gemini CLI
MCP support, Gemini Enterprise MCP in Chat), verified during research.

---

## Other clients

Any standard MCP client that supports **Streamable HTTP with OAuth** (or a raw
Bearer personal access token) can connect:

- **Personal access tokens** — create one in **Settings → Integrations** for
  CLI / stdio MCP clients and scripts:
  ```bash
  npx @modelcontextprotocol/... <or your CLI client> \
    --transport http \
    --url <APP_URL>/api/mcp \
    --token umv_xxxx…
  ```
- **OpenAI Responses API / GPT Actions** — can call the same memory via the
  REST API (`/api/memories/*`) with a personal access token, or via MCP if your
  tooling supports it.

## Legend

- **SUPPORTED** — officially supported by the platform for personal use.
- **PARTIAL** — works but with plan/feature restrictions (documented above).
- **NOT CURRENTLY SUPPORTED** — the platform does not expose a path today; we
  never work around it by scraping.
