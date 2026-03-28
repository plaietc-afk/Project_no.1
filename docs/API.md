# API Reference

All management endpoints require a valid session cookie (`access_token`) obtained via `/auth/login`.
The AI proxy endpoint uses a personal API key (`Authorization: Bearer tg-...`).

Base URL: `http://localhost:4000`

---

<!-- AUTO-GENERATED from backend/src/routes/ + backend/src/index.ts -->

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

Requires session. Users see only their own keys; admins see all.

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

Requires session. Data is scoped to the current user; admins see all users.

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/stats/overview` | `?days=30` | Aggregate totals (tokens, cost, requests, cache hits) |
| `GET` | `/api/stats/by-provider` | `?days=30` | Breakdown by AI provider |
| `GET` | `/api/stats/by-model` | `?days=30` | Breakdown by model |
| `GET` | `/api/stats/by-key` | `?days=30` | Breakdown by API key |
| `GET` | `/api/stats/daily` | `?days=30` | Daily time-series data |
| `GET` | `/api/stats/heatmap` | `?year=2025` | GitHub-style usage heatmap (intensity 0–4) |
| `GET` | `/api/stats/logs` | `?page=1&limit=50` | Paginated request log |

---

## Admin (`/api/admin`)

Requires session with `role = admin`.

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
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `TOKEN_INVALID` | 401 | Expired or malformed JWT |
| `MODEL_NOT_ALLOWED` | 403 | Model not permitted on current package |
| `QUOTA_EXCEEDED` | 429 | Monthly token quota exhausted |
| `BUDGET_EXCEEDED` | 429 | Monthly USD budget exhausted |
| `RATE_LIMIT_RPM` | 429 | Requests-per-minute limit hit |
| `RATE_LIMIT` | 429 | Auth endpoint rate limit hit |
