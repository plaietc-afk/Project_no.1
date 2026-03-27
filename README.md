# TokenGuard

TokenGuard is a blazing-fast, unified AI Proxy and Token Monitoring Dashboard. Built from the ground up to provide seamless multi-model integration and advanced enterprise-grade cost tracking.

## 🚀 Key Features
- **Universal Proxy API:** Connect to 100+ AI models using a single standard format. Dynamically supports **OpenAI, Gemini, Anthropic (Claude 3), Groq, Mistral, Cohere, Azure, and Local AI (Ollama)** without hardcoding logic.
- **Advanced Pricing Engine:** Calculates precise USD cost (`cost_usd`) by accurately separating Prompt Tokens and Completion Tokens based on the specific provider's pricing schema.
- **Cost & Budget Management:** Set hard USD budgets per API Key, assign keys to specific projects, and track spend instantly. Prevent over-spending with automatic budget blocks.
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
Create a `.env` file in the `/backend` directory to activate providers:
```env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
# Add more provider keys as needed
```
