# Contributing to TokenGuard

## Prerequisites

- Node.js 20+
- npm 10+
- Git

## Local Setup

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd TokenGuard

# 2. Install backend dependencies
cd backend && npm install

# 3. Copy and fill env file
cp .env.example .env
# Edit .env — see docs/ENV.md for required variables

# 4. Install frontend dependencies
cd ../frontend && npm install
```

## Running in Development

Start both servers (each in a separate terminal):

<!-- AUTO-GENERATED from backend/package.json + frontend/package.json -->
### Backend Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend with nodemon (hot reload) on port 4000 |
| `npm run start` | Start backend with ts-node (no hot reload) |

### Frontend Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Production build with type checking |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
<!-- END AUTO-GENERATED -->

## Code Style

- **TypeScript** strictly typed — no `any` in application code
- **Immutability** — return new objects, never mutate in place
- **File size** — keep files under 800 lines; extract components when approaching limit
- **Error handling** — handle errors explicitly; never silently swallow them
- **Input validation** — use Zod schemas at all API boundaries

## Type Checking

```bash
# Backend
cd backend && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit
```

## Linting

```bash
# Frontend only (ESLint configured)
cd frontend && npm run lint
```

## Frontend Architecture

```
frontend/src/
├── app/
│   ├── page.tsx          # Dashboard page (thin orchestration layer, ~260 lines)
│   ├── layout.tsx        # Root layout + metadata
│   └── globals.css       # Base styles (dark background, scrollbar, animations)
├── components/
│   ├── StatCard.tsx      # Metric card with icon + accent
│   ├── BarChart.tsx      # Daily cost bar chart with Y-axis + CSV export
│   ├── ProviderPie.tsx   # SVG donut chart for provider breakdown
│   ├── ActivityHeatmap.tsx  # GitHub-style token heatmap
│   ├── KeysTable.tsx     # API keys table with BudgetBar (shows $spent/$budget)
│   ├── BudgetBar         # Named component: progress bar with % spent (nested in KeysTable)
│   ├── NewKeyModal.tsx   # Create key modal with form validation
│   ├── ConfirmDialog.tsx # Reusable destructive-action dialog
│   ├── KeyDrillDown.tsx  # Key detail panel showing drill-down stats
│   ├── LogsTable.tsx     # Paginated request log
│   └── Toast.tsx         # Slide-in toast notifications + useToast hook
├── hooks/
│   ├── useDashboard.ts   # Data fetching (keys, stats, heatmap, keyStats), error state
│   └── useRequestLogs.ts # Request log pagination
└── lib/
    ├── api.ts            # API client + TypeScript types (includes KeyStat)
    └── format.ts         # Shared fmt$() / fmtK() formatters
```

### New Features (Recent Updates)

1. **Budget Bars** — `KeysTable` displays budget utilization (green → amber → red at 70%/90%)
2. **Monthly Forecast** — StatCard projects end-of-month cost from daily average
3. **CSV Export** — Download daily cost data from the BarChart header
4. **keyStats Hook Return** — `useDashboard()` now returns `keyStats: KeyStat[]` for per-key breakdown

## Adding a New AI Provider

1. Create `backend/src/providers/<name>.ts` implementing the `ProviderAdapter` interface
2. Register it in `backend/src/providers/index.ts`
3. Add pricing entries in `backend/src/pricing.ts`
4. Add the provider's API key env var to `backend/.env.example`

## PR Checklist

- [ ] `npx tsc --noEmit` passes in both `backend/` and `frontend/`
- [ ] `npm run lint` passes in `frontend/`
- [ ] No hardcoded secrets or API keys
- [ ] No `console.log` added to frontend code
- [ ] New env vars documented in `.env.example` and `docs/ENV.md`
- [ ] New API endpoints documented in `docs/API.md`
