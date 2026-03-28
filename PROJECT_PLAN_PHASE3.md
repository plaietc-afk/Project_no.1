# TokenGuard - Phase 3 (Open-Source & Developer Experience)

**Objective:** Enhance the open-source, self-hosted experience. Zero-friction setup (no mandatory login) with powerful enterprise-grade features that developers love to clone and use for free.

## 🎯 Target Features

### 1. ⚡ Semantic Caching Layer (The Money Saver)
- **Goal:** If a user sends the exact same prompt (or semantically identical prompt), return the cached response instantly without hitting OpenAI/Gemini APIs.
- **Implementation:** 
  - Add an in-memory cache or Redis integration in the Express Backend.
  - Track "Cached Hits" vs "API Hits" on the Dashboard to show users exactly how much money ($) the proxy saved them.

### 2. 🚨 Budget Alerts & Webhooks
- **Goal:** Notify users before their API keys run out of budget.
- **Implementation:**
  - Add Webhook URLs per API Key or global settings.
  - Send alerts to Discord / Telegram / Slack when an API Key hits 80%, 90%, and 100% of its budget.

### 3. ⏱️ Rate Limiting & Throttling
- **Goal:** Protect against accidental infinite loops in user code hitting the APIs.
- **Implementation:**
  - Configurable Requests Per Minute (RPM) and Tokens Per Minute (TPM) limits per API Key.
  - Return HTTP 429 Too Many Requests cleanly.

## 📅 Sprint Assignments
- **Backend (`dev-backend`):** Implement the Caching Layer and Rate Limiting first.
- **Frontend (`dev-frontend`):** Add a "Money Saved" widget to the Dashboard based on Cache Hits.
