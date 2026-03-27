# TokenGuard (The LiteLLM Killer)

TokenGuard is a blazing-fast, unified AI Proxy and Token Monitoring Dashboard. Built from the ground up as a clean-room implementation of concepts found in projects like `litellm` and `ai-token-monitor`.

## 🚀 Features (Phase 2)
- **Universal Proxy API (Adapter Pattern):** Connect to 100+ AI models using a single standard OpenAI format. Supports **OpenAI, Gemini, Anthropic (Claude 3), Groq, Mistral, Cohere, Azure, and Local AI (Ollama)** dynamically.
- **Advanced Pricing Engine:** Calculates precise `cost_usd` by separating Prompt Tokens and Completion Tokens based on the specific provider's pricing.
- **Cost & Budget Management:** Set hard USD budgets per API Key, assign keys to specific `project_id`s, and track spend instantly.
- **Premium Dark Mode UI:** A sleek, modern dashboard built with Next.js and Tailwind CSS featuring interactive spend charts, API Key status indicators (Active, Over Budget, Revoked), and real-time monitoring widgets.

## 🛠️ Tech Stack
- **Frontend:** Next.js (App Router), Tailwind CSS, Lucide Icons, Recharts (Dark Mode).
- **Backend:** Express.js, SQLite3 (for Token/Cost Logging & API Keys).
- **Infrastructure:** Docker, Docker Compose.

## 🐳 Quick Start (Docker)
1. Clone the repository and navigate to the root directory.
2. Run the following command:
   ```bash
   docker-compose up --build -d
   ```
3. Access the Dashboard at: `http://localhost:3000`
4. Send AI requests to the Proxy at: `http://localhost:8080/v1/chat/completions`

## 🔒 Environment Variables
Create a `.env` file in the `/backend` directory:
```env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
# Add more provider keys as needed
```
