# Authentication

> **For AI agents:** WealthClick uses API keys for all programmatic access. You need a `wc_` Bearer token before calling any REST or MCP endpoint. This file explains how to obtain and use one.

---

## Overview

WealthClick uses **API key authentication** for programmatic access. A key is a secret token that identifies you and scopes all data access to your own account. Row-level security enforces this at the database level — keys from one account cannot access another account's data.

---

## Generating an API Key

### Via the Settings UI (recommended)

1. Sign in to WealthClick with your Google account
2. Navigate to **Settings** (`/<locale>/settings`)
3. Enter a descriptive name for the key (e.g. `"OpenClaw"`, `"My Script"`)
4. Click **Create Key**
5. Copy the token displayed — **it is shown exactly once**
6. Store it in a secrets manager or environment variable

### Via the REST API (programmatic)

Requires an active browser session (Google OAuth cookie). Use this if you're bootstrapping a key from a script that already has session access.

**Request:**

```http
POST /api/v1/keys
Content-Type: application/json
Cookie: <session cookie from browser>

{
  "name": "OpenClaw"
}
```

**Response `201 Created`:**

```json
{
  "id": "a1b2c3d4-...",
  "name": "OpenClaw",
  "token": "wc_a3f9b2c1d4e5f60718293a4b5c6d7e8f...",
  "warning": "Store this token securely. It will not be shown again."
}
```

> The `token` field is returned **only in this response**. The database stores only a SHA-256 hash.

---

## Token Format

```
wc_<64 lowercase hex characters>
```

Total length: **67 characters**

Example:
```
wc_a3f9b2c1d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8
```

---

## Using a Token

### REST API

Include the token as a Bearer token in the `Authorization` header on every request:

```http
GET /api/v1/transactions?from=2025-03-01&to=2025-03-31
Authorization: Bearer wc_your_token_here
```

### MCP Server

Include the token as a Bearer token **on the `initialize` request only**. After initialization the server issues a `Mcp-Session-Id` — use that on all subsequent requests instead.

```http
POST /api/mcp
Authorization: Bearer wc_your_token_here
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
```

---

## Listing and Revoking Keys

### List keys (no plaintext returned)

```http
GET /api/v1/keys
Cookie: <session cookie>
```

```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "OpenClaw",
      "created_at": "2025-04-18T14:00:00.000Z",
      "last_used_at": "2025-04-18T15:30:00.000Z"
    }
  ]
}
```

### Revoke a key

```http
DELETE /api/v1/keys
Content-Type: application/json
Cookie: <session cookie>

{ "id": "a1b2c3d4-..." }
```

```json
{ "deleted": "a1b2c3d4-..." }
```

---

## Error Responses

| Scenario | HTTP status | Body |
|---|---|---|
| Missing or malformed Authorization header | `401` | `{"error": "Unauthorized — provide a valid Bearer token"}` |
| Token not found / revoked | `401` | `{"error": "Unauthorized — provide a valid Bearer token"}` |
| Token does not start with `wc_` | `401` | `{"error": "Unauthorized — provide a valid Bearer token"}` |

---

## Security Notes

- Tokens are **never stored in plaintext** — only their SHA-256 hash is in the database
- Each API call updates `last_used_at` for the key — you can detect stale or compromised keys
- Maximum **10 active keys** per user account
- Revoke immediately from Settings if a key is compromised
- Do not include tokens in URLs (query strings) — always use the `Authorization` header
