# MCP Server Reference

> **For AI agents:** This file documents the WealthClick MCP server at `/api/mcp`. Use this if you are an MCP-compatible client (Claude.ai, OpenClaw, or any MCP 2024-11-05 client). The server exposes 6 tools covering read and write access to financial data. Authenticate once with a Bearer token on `initialize` — subsequent requests use the session ID returned in the response header.

---

## Overview

WealthClick implements an **MCP (Model Context Protocol) server** using the Streamable HTTP transport (protocol version `2024-11-05`). It exposes financial data and transaction management as MCP tools, allowing any MCP-compatible AI assistant to query and modify your personal finance data through natural language.

---

## Connection Details

| Property | Value |
|---|---|
| **Endpoint** | `https://<your-domain>/api/mcp` |
| **Protocol** | MCP `2024-11-05` |
| **Transport** | Streamable HTTP |
| **Auth** | Bearer token on `initialize`, then `Mcp-Session-Id` header |
| **HTTP methods** | `POST` (messages), `DELETE` (session cleanup) |

---

## Connecting from Claude.ai

1. Go to **Claude.ai → Settings → Integrations → MCP Servers**
2. Click **Add MCP Server**
3. Enter URL: `https://<your-domain>/api/mcp`
4. Add header: `Authorization: Bearer wc_your_token_here`
5. Save — Claude will call `initialize` automatically

---

## Connecting from OpenClaw

1. Open OpenClaw → **Skills / Integrations**
2. Add a new API integration or MCP connection
3. Set the endpoint to `https://<your-domain>/api/mcp`
4. Configure the `Authorization: Bearer wc_your_token_here` header
5. OpenClaw will discover tools automatically via `tools/list`

---

## Connection Procedure (step-by-step)

### Step 1 — Initialize (authenticate)

Send an `initialize` request with your Bearer token. This is the **only** request that requires the `Authorization` header.

**Request:**

```http
POST /api/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer wc_your_token_here

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "OpenClaw",
      "version": "1.0.0"
    }
  }
}
```

**Response `200`:**

```http
Content-Type: application/json
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "WealthClick", "version": "1.0.0" }
  }
}
```

**Save the `Mcp-Session-Id` value** — include it as a header on all subsequent requests.

---

### Step 2 — Send initialized notification

```http
POST /api/mcp
Content-Type: application/json
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**Response `202 Accepted`** (no body)

---

### Step 3 — Discover tools

```http
POST /api/mcp
Content-Type: application/json
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response `200`:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [ /* see Tools section below */ ]
  }
}
```

---

### Step 4 — Call a tool

```http
POST /api/mcp
Content-Type: application/json
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_spending_summary",
    "arguments": { "month": "2025-03" }
  }
}
```

**Response `200`:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "📊 Spending Summary — 2025-03\n\n💰 Income:   ₪12,500 (+5% vs last month)\n💸 Expenses: ₪8,240 (-3% vs last month)\n📈 Net:      +₪4,260\n\n📂 Expenses by category:\n  • 🍔 Food & Dining: ₪1,840 (22%)\n  • 🚗 Transportation: ₪960 (12%)\n..."
      }
    ]
  }
}
```

---

### Step 5 — End session (optional)

```http
DELETE /api/mcp
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000
```

**Response `200`** (no body)

---

## Tools Reference

### `get_transactions`

List financial transactions for a date range.

**Input schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | `string` (date) | Yes | Start date `YYYY-MM-DD` (inclusive) |
| `to` | `string` (date) | Yes | End date `YYYY-MM-DD` (inclusive) |
| `type` | `string` | No | `"income"` or `"expense"` |
| `limit` | `number` | No | Max results (default 100, max 500) |

**Example call:**

```json
{
  "name": "get_transactions",
  "arguments": {
    "from": "2025-03-01",
    "to": "2025-03-31",
    "type": "expense",
    "limit": 50
  }
}
```

**Example output:**

```
Transactions from 2025-03-01 to 2025-03-31 (12 transactions, net: -₪8,240):

• 2025-03-28 -₪142 — Super-Pharm [💊 Health & Medical] (Visa)
• 2025-03-25 -₪320 — Rami Levy [🍔 Food & Dining] (Checking)
...
```

---

### `get_spending_summary`

Monthly spending report: income vs expenses, category breakdown, top expenses, spending pace, and month-over-month comparison.

**Input schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `month` | `string` | Yes | Month in `YYYY-MM` format |

**Example call:**

```json
{
  "name": "get_spending_summary",
  "arguments": { "month": "2025-03" }
}
```

**Example output:**

```
📊 Spending Summary — 2025-03

💰 Income:   ₪12,500 (+5% vs last month)
💸 Expenses: ₪8,240 (-3% vs last month)
📈 Net:      +₪4,260

📂 Expenses by category:
  • 🍔 Food & Dining: ₪1,840 (22%)
  • 🚗 Transportation: ₪960 (12%)
  • 🏠 Housing & Rent: ₪3,500 (42%)

🔝 Top expenses:
  1. Rent — ₪3,500 on 2025-03-01
  2. Electricity — ₪460 on 2025-03-05

⏱️ Spending pace: 22/31 days active, avg ₪374/day
```

---

### `list_categories`

Returns all spending categories for the account.

**Input schema:** none (empty object)

**Example call:**

```json
{ "name": "list_categories", "arguments": {} }
```

**Example output:**

```
Your categories:

• 📚 Education / חינוך  (id: 11111111-...)
• 🍔 Food & Dining / אוכל ומסעדות  (id: 22222222-...)
• 💊 Health & Medical / בריאות  (id: 33333333-...)
...
```

Use the `id` values when creating or updating transactions with a category.

---

### `create_transaction`

Create a new financial transaction.

**Input schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `description` | `string` | Yes | Transaction description |
| `amount` | `number` | Yes | Positive amount in ILS |
| `type` | `string` | Yes | `"income"` or `"expense"` |
| `date` | `string` (date) | Yes | `YYYY-MM-DD` |
| `category_id` | `string` (uuid) | No | Category UUID |
| `account` | `string` | No | Account name |

**Example call:**

```json
{
  "name": "create_transaction",
  "arguments": {
    "description": "Super-Pharm",
    "amount": 142.5,
    "type": "expense",
    "date": "2025-03-15",
    "account": "Visa"
  }
}
```

**Example output:**

```
Transaction created with id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

### `update_transaction`

Partially update an existing transaction. Only fields you provide are changed.

**Input schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (uuid) | Yes | Transaction UUID to update |
| `description` | `string` | No | New description |
| `amount` | `number` | No | New amount (positive) |
| `type` | `string` | No | `"income"` or `"expense"` |
| `date` | `string` (date) | No | New date `YYYY-MM-DD` |
| `category_id` | `string` \| `null` | No | New category UUID, or `null` to remove |
| `account` | `string` \| `null` | No | New account name, or `null` to remove |

**Example call:**

```json
{
  "name": "update_transaction",
  "arguments": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "category_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
  }
}
```

**Example output:**

```
Transaction a1b2c3d4-... updated.
```

---

### `delete_transaction`

Delete a transaction permanently.

**Input schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (uuid) | Yes | Transaction UUID to delete |

**Example call:**

```json
{
  "name": "delete_transaction",
  "arguments": { "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
}
```

**Example output:**

```
Transaction a1b2c3d4-... deleted.
```

---

## Error Handling

Tool errors return a result with `isError: true`:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "Error: Transaction not found" }],
    "isError": true
  }
}
```

Protocol-level errors use standard JSON-RPC error codes:

| Code | Meaning |
|---|---|
| `-32700` | Parse error — invalid JSON |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32000` | Not initialized — send `initialize` first |
| `-32001` | Unauthorized — Bearer token missing or invalid |

---

## Session Lifecycle

```
Client                          WealthClick MCP Server
  │                                      │
  │── POST initialize (Bearer token) ───>│
  │<─ 200 + Mcp-Session-Id ─────────────│
  │                                      │
  │── POST notifications/initialized ──>│
  │<─ 202 Accepted ─────────────────────│
  │                                      │
  │── POST tools/list ──────────────────>│
  │<─ 200 {tools:[...]} ────────────────│
  │                                      │
  │── POST tools/call ──────────────────>│
  │<─ 200 {content:[...]} ──────────────│
  │                                      │
  │── DELETE (session cleanup) ─────────>│
  │<─ 200 ──────────────────────────────│
```

Sessions are stored in memory on the server process. They persist as long as the server is running (PM2 on EC2). If the server restarts, sessions are lost and clients must re-initialize.

---

## Implementation Notes

- **No SSE streaming** — the server returns `application/json` for all tool calls (not `text/event-stream`). `GET /api/mcp` returns `405 Method Not Allowed`.
- **Stateful sessions** — the `Mcp-Session-Id` is a UUID stored in-memory. Include it on every request after `initialize`.
- **Auto-categorization** — `create_transaction` and `update_transaction` with a `category_id` automatically learn a rule for that description.
- **Data isolation** — each session is bound to one user account; a token cannot access another user's data.
