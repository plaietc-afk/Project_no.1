# API Reference

TokenGuard is an open-access self-hosted tool. Management endpoints (`/api/keys`, `/api/stats`) require **no authentication** — anyone who can reach the server can use them. The admin section (`/api/admin`) still requires an admin session cookie.

The AI proxy endpoint uses a personal API key (`Authorization: Bearer tg-...`).

Base URL: `http://localhost:4000`

---

<!-- AUTO-GENERATED from backend/src/routes/ + backend/src/index.ts -->
Last Updated: 2026-03-30

## Proxy

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/chat/completions` | API key (Bearer) | OpenAI-compatible chat completion — routes to any configured provider |
| `GET` | `/health` | None | Health check — returns `{ status: "ok", timestamp }` |

### Proxy request body

```json
{
  "model": "gpt-4o",
  "messages": [{ "role": "user", "content": "Hello" }],
  "provider": "openai"
}
```

The `provider` field is optional. If omitted, TokenGuard uses the provider registered for the key or falls back to the SmartRouter order.

---

## Auth (`/auth`)

Rate limited: 10 requests / 15 minutes per IP.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | None | Create account → returns personal API key (shown once) |
| `POST` | `/auth/login` | None | Login → sets `access_token` + `refresh_token` httpOnly cookies |
| `POST` | `/auth/logout` | None | Clears auth cookies |
| `POST` | `/auth/refresh` | Refresh cookie | Rotate access + refresh tokens |
| `GET` | `/auth/me` | Session | Current user + package + usage |
| `PUT` | `/auth/password` | Session | Change password |

---

## API Keys (`/api/keys`)

No authentication required. All keys are visible to anyone who can reach the server.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/keys` | List keys (paginated) |
| `POST` | `/api/keys` | Create key — returns plaintext key once |
| `GET` | `/api/keys/:id` | Get key detail |
| `PUT` | `/api/keys/:id` | Update key (name, budget, limits, webhook) |
| `DELETE` | `/api/keys/:id` | Revoke key |
| `POST` | `/api/keys/:id/rotate` | Rotate key secret — returns new plaintext key |
| `POST` | `/api/keys/test-webhook` | Send test webhook payload to a URL |

---

## Analytics (`/api/stats`)

No authentication required. All endpoints accept an optional `?user_id=N` query parameter to filter by a specific named user.

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/stats/overview` | `?days=30&user_id=N` | Aggregate totals (tokens, cost, requests, cache hits) |
| `GET` | `/api/stats/by-provider` | `?days=30&user_id=N` | Breakdown by AI provider |
| `GET` | `/api/stats/by-model` | `?days=30&user_id=N` | Breakdown by model |
| `GET` | `/api/stats/by-key` | `?days=30&user_id=N` | Breakdown by API key |
| `GET` | `/api/stats/daily` | `?days=30&user_id=N` | Daily time-series data |
| `GET` | `/api/stats/heatmap` | `?year=2025&user_id=N` | GitHub-style usage heatmap (intensity 0–4) |
| `GET` | `/api/stats/by-user` | `?days=30` | Breakdown by named user (email/display_name, tokens, cost) |
| `GET` | `/api/stats/latency` | `?days=30&user_id=N` | Provider latency statistics (P50, P95, average ms, request count) |
| `GET` | `/api/stats/cost-comparison/classes` | None | List available model classes for cost comparison |
| `GET` | `/api/stats/cost-comparison` | `?prompt_tokens=N&completion_tokens=N&model_class=standard` | Cost breakdown by model within a class |
| `GET` | `/api/stats/logs` | `?page=1&limit=50&user_id=N&key_id=N` | Paginated request log |

---

## Users (`/api/users`)

No authentication required. Create or manage named users (for tracking usage per team member, project, etc.).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List all named users |
| `POST` | `/api/users` | Create a named user from `{ display_name: "Alice" }` |
| `GET` | `/api/users/:id` | Get user detail |
| `PUT` | `/api/users/:id` | Update user from `{ display_name: "Alice Updated" }` |
| `DELETE` | `/api/users/:id` | Delete user (only if no active API keys) |

---

## Admin (`/api/admin`)

Requires a session cookie (`access_token`) with `role = admin`. Obtain one via `POST /auth/login`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List all users with usage summary |
| `GET` | `/api/admin/users/:id` | User detail |
| `PUT` | `/api/admin/users/:id/package` | Assign package to user |
| `PUT` | `/api/admin/users/:id/activate` | Activate or deactivate user |
| `GET` | `/api/admin/packages` | List all packages |
| `POST` | `/api/admin/packages` | Create new package |
| `PUT` | `/api/admin/packages/:id` | Update package limits |
| `GET` | `/api/admin/stats` | Global usage broken down by package tier |

<!-- END AUTO-GENERATED -->

---

## Error Response Format

```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

Common error codes:

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHENTICATED` | 401 | Missing or invalid token (admin endpoints only) |
| `TOKEN_INVALID` | 401 | Expired or malformed JWT |
| `KEY_INVALID` | 401 | API key missing, revoked, or not found |
| `BUDGET_EXCEEDED` | 429 | Key USD budget exhausted |
| `RATE_LIMIT_RPM` | 429 | Requests-per-minute limit hit on key |
| `RATE_LIMIT` | 429 | Auth endpoint rate limit hit (10 req/15 min) |
