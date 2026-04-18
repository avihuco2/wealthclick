# WealthClick — Developer & AI Agent Documentation

> **For AI agents:** This directory contains complete technical documentation for the WealthClick API and MCP server. Start here to understand available integration methods, then read the relevant reference file. All endpoints require an API key — see [Authentication](#authentication) below.

---

## What is WealthClick?

WealthClick is a personal finance management application. It stores financial transactions (income and expenses), organises them into categories, and provides monthly insights. Users authenticate with Google OAuth.

The application exposes two programmatic integration surfaces:

| Surface | Best for | Auth |
|---|---|---|
| **REST API** (`/api/v1/*`) | HTTP clients, scripts, automation | Bearer token |
| **MCP Server** (`/api/mcp`) | AI assistants (Claude, OpenClaw, any MCP client) | Bearer token on init |

---

## Documentation Index

| File | Contents |
|---|---|
| [`authentication.md`](./authentication.md) | How to generate API keys and authenticate requests |
| [`api.md`](./api.md) | Full REST API reference — all endpoints, schemas, curl examples |
| [`mcp.md`](./mcp.md) | MCP server reference — tools, connection procedure, JSON-RPC examples |

---

## Authentication

All programmatic access uses **API keys** — long-lived Bearer tokens generated from the Settings UI.

**Token format:** `wc_` followed by 64 lowercase hex characters  
**Example:** `wc_a3f9b2c1d4e5f6...` (67 chars total)

Steps:
1. Sign in at `https://<your-domain>/en/settings`
2. Enter a key name (e.g. "OpenClaw") and click **Create Key**
3. Copy the token — **it is shown only once**
4. Use it as `Authorization: Bearer <token>` on every REST request, or on the MCP `initialize` call

Security properties:
- Only the SHA-256 hash of the token is stored in the database
- Each use updates `last_used_at` for audit purposes
- Maximum 10 keys per user account
- Keys can be revoked from the Settings UI at any time

---

## Base URL

```
https://<your-domain>
```

Replace `<your-domain>` with your deployed domain. All paths below are relative to this base.

---

## Quick-start: REST API (curl)

```bash
TOKEN="wc_your_token_here"
BASE="https://<your-domain>"

# List transactions for March 2025
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/transactions?from=2025-03-01&to=2025-03-31"

# Get monthly spending summary
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/transactions?from=2025-03-01&to=2025-03-31&type=expense"
```

---

## Quick-start: MCP (AI agent)

```
MCP endpoint:  https://<your-domain>/api/mcp
Protocol:      MCP 2024-11-05 (Streamable HTTP)
Auth header:   Authorization: Bearer wc_your_token_here
```

Connect your MCP client to the endpoint above with the Authorization header set. The server will authenticate on `initialize` and issue a session ID for all subsequent calls.

Available tools: `get_transactions`, `get_spending_summary`, `list_categories`, `create_transaction`, `update_transaction`, `delete_transaction`

---

## For AI Agents — Integration Guidance

If you are an AI agent reading this file, follow this decision tree:

```
Need financial data from WealthClick?
│
├── You are an MCP client (Claude.ai, OpenClaw, etc.)
│   └── Use the MCP server → read mcp.md
│
└── You are making HTTP requests directly (script, tool, API call)
    └── Use the REST API → read api.md
```

Always read [`authentication.md`](./authentication.md) first — you need a valid `wc_` token before any call will succeed.
