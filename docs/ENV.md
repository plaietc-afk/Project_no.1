# Environment Variables

<!-- AUTO-GENERATED from backend/.env.example -->

## Backend (`backend/.env`)

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | Port the backend server listens on |
| `FRONTEND_URL` | No | `http://localhost:3000` | Allowed CORS origin |

### Authentication

| Variable | Required | Description | How to generate |
|----------|----------|-------------|----------------|
| `JWT_SECRET` | **Yes** | Signs access tokens (15 min lifetime) | `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | **Yes** | Signs refresh tokens (7 day lifetime) | `openssl rand -hex 64` (different from JWT_SECRET) |

> Both secrets must be set or the server will refuse to start.

### Admin Seed Account

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_EMAIL` | **Yes** (first run) | Email address for the seeded admin account |
| `ADMIN_PASSWORD` | **Yes** (first run) | Password for the seeded admin account — must be set before first run |

> These are only used when the `users` table is empty (first run). After seeding, they have no effect.

### AI Provider Keys

All provider keys are optional. Only configure the providers you intend to use.

| Variable | Provider | Format |
|----------|----------|--------|
| `OPENAI_API_KEY` | OpenAI | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic | `sk-ant-...` |
| `GEMINI_API_KEY` | Google Gemini | `AIza...` |
| `GROQ_API_KEY` | Groq | `gsk_...` |
| `MISTRAL_API_KEY` | Mistral AI | any string |
| `COHERE_API_KEY` | Cohere | any string |
| `AWS_ACCESS_KEY_ID` | AWS Bedrock | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS Bedrock | IAM secret key |
| `AWS_REGION` | AWS Bedrock | e.g. `us-east-1` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI | `https://<resource>.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | Azure OpenAI | Deployment name, e.g. `gpt-4o` |

<!-- END AUTO-GENERATED -->

## Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` | Backend base URL for API calls |
