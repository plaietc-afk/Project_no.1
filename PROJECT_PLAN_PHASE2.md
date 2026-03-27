# Web App Token Monitor - Phase 2 (Feature Parity)

**Objective:** Clean-room implementation of core features from `soulduse/ai-token-monitor` and `BerriAI/litellm` without copying any proprietary code.

## 🎯 Target Features
### 1. Unified Proxy API (Inspired by LiteLLM)
- Accept standard OpenAI format requests for ALL models (Gemini, Claude, etc.).
- The backend must translate the request to the specific provider's format and translate the response back to OpenAI format.
- **Resilience:** Implement Fallback mechanism (e.g., if OpenAI 500s, fallback to Gemini).
- **Load Balancing:** Distribute requests across multiple API keys if one hits rate limits.

### 2. Advanced Monitoring & Cost Tracking (Inspired by ai-token-monitor)
- **Database Expansion:** Add `cost_usd`, `user_id`, and `project_id` to `token_logs`.
- **Pricing Engine:** Calculate real cost based on model pricing (e.g., GPT-4 vs GPT-3.5 token prices).
- **Dashboard Upgrade:** 
  - Show total spend ($) alongside token counts.
  - Visualize usage per project/user.
  - Set budget limits per API Key (Auto-revoke/block if over budget).

## 📅 Sprint Assignments
- **Backend (`dev-backend`):** Start immediately on the Unified Proxy API and Pricing Engine.
- **Frontend (`dev-frontend`):** After backend API is stable, update Dashboard to show Cost/Budgets.
- **QA (`qa-tester`):** Test fallback scenarios and budget limits.

### 3. Modern UI/UX Overhaul (Frontend Redesign)
- **Vibe:** Sleek, modern, and professional. Dark mode support by default.
- **Tech Stack:** Utilize modern UI libraries (e.g., Shadcn UI, Tremor for charts, Tailwind CSS, Framer Motion for smooth animations).
- **Dashboard Redesign:** 
  - Real-time spend monitoring widgets.
  - Interactive, modern charts for token/cost analysis.
  - Clean API Key management table with status indicators (Active, Over Budget, Revoked).

### 4. Ultimate Multi-Provider Support (The "LiteLLM Killer")
- **Scale to 100+ Models:** Do not hardcode just OpenAI and Gemini. Implement a dynamic adapter pattern to support *Anthropic (Claude 3), Cohere, Groq, Mistral, Azure OpenAI, AWS Bedrock, HuggingFace, and Local models (Ollama, vLLM)*.
- **Universal Translation Layer:** Every incoming request must be parsed and mapped dynamically to the target provider's schema.
- **Goal:** Make the system explicitly "better than the cloned references" by making it lighter, faster, and supporting more models out of the box with zero-config.
