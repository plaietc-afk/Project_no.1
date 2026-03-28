# Runbook

Operational guide for deploying and maintaining TokenGuard.

---

## Deployment

### Prerequisites

- Node.js 20+
- A writable directory for the SQLite database (`backend/data.db`)
- Environment variables set (see `docs/ENV.md`)

### Steps

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Set environment variables
cp backend/.env.example backend/.env
# Fill in JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
# Add at least one AI provider key

# 3. Start backend (first run seeds DB + admin user)
cd backend && npm run start

# 4. Build + start frontend
cd frontend && npm run build && npm run start
```

On first start the backend will:
1. Create `backend/data.db` with all tables
2. Seed 3 default packages (Free / Pro / Enterprise)
3. Create the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`

> If `ADMIN_EMAIL` or `ADMIN_PASSWORD` are missing, the server throws and exits.

---

## Health Check

```bash
curl http://localhost:4000/health
# {"status":"ok","timestamp":"2026-03-28T16:00:00.000Z"}
```

---

## Default Package Tiers

| Tier | Token quota | USD budget | RPM | Models |
|------|------------|------------|-----|--------|
| Free | 100,000 / mo | $2.00 / mo | 10 | gpt-3.5-turbo, gemini-1.5-flash-latest, llama3-8b-8192 |
| Pro | 5,000,000 / mo | $50.00 / mo | 100 | All models |
| Enterprise | Unlimited | Unlimited | 1,000 | All models |

Manage tiers via `PUT /api/admin/packages/:id` or directly in the admin panel.

---

## Common Issues

### Server exits immediately on start

**Cause:** Missing required env vars.
```
[FATAL] JWT_SECRET and JWT_REFRESH_SECRET must be set.
[FATAL] ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment before first run.
```
**Fix:** Set the missing variables in `backend/.env`.

---

### `EADDRINUSE` on port 4000

**Cause:** Another process is holding port 4000.
```bash
# Find the PID
netstat -ano | grep ":4000"
# Kill it (Windows)
taskkill /PID <pid> /F
# Kill it (Linux/Mac)
kill -9 <pid>
```

---

### `Invalid or revoked API Key` on proxy calls

**Cause:** Key was rotated or revoked, or is being sent as plaintext after a rotation.
**Fix:** Rotate the key via `POST /api/keys/:id/rotate` and update the client with the new `tg-...` value.

---

### User quota exceeded but usage looks low

**Cause:** `usage_reset_at` may be stale if the server was down during the reset window.
**Fix (admin):** Reset via `PUT /api/admin/users/:id/package` (re-assign same package) or update `tokens_used = 0, usd_spent = 0` directly in the DB.

---

### Webhook alerts not firing

1. Check `webhook_url` is set on the key (`GET /api/keys/:id`)
2. Check `alert_thresholds` is a non-empty array (e.g. `[80, 100]`)
3. Verify the webhook endpoint is reachable: `POST /api/keys/test-webhook`
4. Inspect `backend` stderr for `[Alert] Webhook failed:` messages

---

## Database

TokenGuard uses SQLite (`backend/data.db`). Back it up by copying the file while the server is idle, or use the WAL checkpoint:

```bash
cp backend/data.db backend/data.db.bak
```

Tables: `packages`, `users`, `api_keys`, `token_logs`, `request_cache`

---

## Rollback

1. Stop the server
2. Restore `backend/data.db` from backup
3. Checkout the previous git tag / commit
4. `npm install` and restart

---

## Supported AI Providers

| Provider | Key env var | Notes |
|----------|-------------|-------|
| OpenAI | `OPENAI_API_KEY` | |
| Anthropic | `ANTHROPIC_API_KEY` | |
| Google Gemini | `GEMINI_API_KEY` | |
| Groq | `GROQ_API_KEY` | |
| Mistral AI | `MISTRAL_API_KEY` | |
| Cohere | `COHERE_API_KEY` | |
| AWS Bedrock | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION` | IAM auth |
| Azure OpenAI | `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_DEPLOYMENT` | |
