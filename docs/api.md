# REST API Reference

> **For AI agents:** This file documents the WealthClick REST API at `/api/v1`. All endpoints require `Authorization: Bearer wc_<token>`. Dates are `YYYY-MM-DD`, amounts are numbers in ILS (Israeli Shekel). UUIDs identify transactions and categories.

---

## Base URL

```
https://<your-domain>/api/v1
```

---

## Authentication

All endpoints require:

```http
Authorization: Bearer wc_your_token_here
```

See [`authentication.md`](./authentication.md) for how to generate a token.

---

## Interactive Docs

A live Swagger UI is available at:

```
https://<your-domain>/api/v1/docs
```

The raw OpenAPI 3.0 JSON spec:

```
https://<your-domain>/api/v1/openapi
```

---

## Data Types

| Type | Format | Example |
|---|---|---|
| UUID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| Date | `YYYY-MM-DD` | `"2025-03-15"` |
| Datetime | ISO 8601 | `"2025-03-15T10:30:00.000Z"` |
| Amount | `number` (ILS, positive) | `142.5` |
| Type | `"income"` \| `"expense"` | `"expense"` |

---

## Endpoints

### Transactions

#### `GET /transactions` — List transactions

Returns transactions for the authenticated user within a date range.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | `date` | Yes | Start date inclusive (`YYYY-MM-DD`) |
| `to` | `date` | Yes | End date inclusive (`YYYY-MM-DD`) |
| `type` | `string` | No | Filter: `"income"` or `"expense"` |
| `limit` | `integer` | No | Max results (default `100`, max `500`) |

**Request:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://<your-domain>/api/v1/transactions?from=2025-03-01&to=2025-03-31"
```

**Response `200`:**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "date": "2025-03-15",
      "description": "Super-Pharm",
      "amount": 142.5,
      "type": "expense",
      "account": "Visa",
      "category": {
        "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
        "name_en": "Health & Medical",
        "name_he": "בריאות",
        "color": "#FF6B6B",
        "emoji": "💊"
      },
      "created_at": "2025-03-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

`category` is `null` for uncategorized transactions.

---

#### `POST /transactions` — Create transaction

**Request body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| `description` | `string` | Yes | Transaction description |
| `amount` | `number` | Yes | Positive amount in ILS |
| `type` | `string` | Yes | `"income"` or `"expense"` |
| `date` | `date` | Yes | `YYYY-MM-DD` |
| `category_id` | `uuid` | No | Category UUID (from `GET /categories`) |
| `account` | `string` | No | Account name e.g. `"Visa"`, `"Checking"` |

**Request:**

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Super-Pharm",
    "amount": 142.5,
    "type": "expense",
    "date": "2025-03-15",
    "account": "Visa"
  }' \
  "https://<your-domain>/api/v1/transactions"
```

**Response `201`:**

```json
{ "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

If `category_id` is provided, a category rule is automatically learned for this description — future transactions with the same description will be auto-categorized.

---

#### `PATCH /transactions/{id}` — Update transaction

Partial update — only include fields you want to change.

**Path parameter:** `id` — UUID of the transaction

**Request body (JSON) — all fields optional:**

| Field | Type | Description |
|---|---|---|
| `description` | `string` | New description |
| `amount` | `number` | New amount (positive) |
| `type` | `string` | `"income"` or `"expense"` |
| `date` | `date` | New date `YYYY-MM-DD` |
| `category_id` | `uuid` \| `null` | New category, or `null` to uncategorize |
| `account` | `string` \| `null` | New account name, or `null` to clear |

**Request:**

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"}' \
  "https://<your-domain>/api/v1/transactions/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**Response `200`:**

```json
{ "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

---

#### `DELETE /transactions/{id}` — Delete transaction

**Path parameter:** `id` — UUID of the transaction

**Request:**

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "https://<your-domain>/api/v1/transactions/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**Response `200`:**

```json
{ "deleted": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

---

### Categories

#### `GET /categories` — List categories

Returns all categories for the authenticated user.

**Request:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://<your-domain>/api/v1/categories"
```

**Response `200`:**

```json
{
  "data": [
    {
      "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "name_en": "Food & Dining",
      "name_he": "אוכל ומסעדות",
      "color": "#FF6B6B",
      "emoji": "🍔",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 11
}
```

Use `id` values from this response as `category_id` when creating or updating transactions.

---

## Error Responses

All errors return a JSON body with an `error` string field.

| Status | Meaning |
|---|---|
| `400` | Bad request — missing or invalid parameters |
| `401` | Unauthorized — missing or invalid Bearer token |
| `404` | Resource not found, or does not belong to your account |
| `429` | Rate limit — e.g. max 10 API keys per user |

**Example:**

```json
{ "error": "from and to query params are required (YYYY-MM-DD)" }
```

---

## Validation Rules

- `from` must be ≤ `to`
- `amount` must be a positive number (> 0)
- `date` must match `YYYY-MM-DD` exactly
- `type` must be exactly `"income"` or `"expense"`
- `limit` is clamped between 1 and 500
- Transactions not belonging to the authenticated user return `404` (not `403`) to avoid data leakage

---

## Auto-categorization

When you create or update a transaction with a `category_id`, WealthClick automatically learns a **category rule** for that description. Future transactions — including those imported by the bank scraper — with the same description will be assigned to the same category automatically.
