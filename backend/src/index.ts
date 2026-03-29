import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import db from './db';
import { calculateCost } from './pricing';
import { SmartRouter, RouterExhaustedError } from './router';
import type { RouterEntry } from './router';
import keysRouter from './routes/keys';
import analyticsRouter from './routes/analytics';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';
import { requireAuth } from './middleware/requireAuth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '4mb' }));

// ---- In-Memory Rate Limiting Store ----
interface RateLimitRecord { rpmCount: number; tpmCount: number; windowStart: number; }
const rateLimitStore: Record<number, RateLimitRecord> = {};

// ---- Package row type ----
interface PackageRow {
  id: number;
  name: string;
  token_quota: number;
  usd_budget: number;
  rpm_limit: number;
  allowed_models: string;
  reset_period: string;
}
interface UserRow {
  id: number;
  email: string;
  role: string;
  package_id: number;
  tokens_used: number;
  usd_spent: number;
  usage_reset_at: string | null;
  is_active: number;
}

// ---- Middleware: Authenticate via API key and load user + package ----
const authenticateAndLoadKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, error: 'Missing Authorization header' });
  const token = authHeader.split(' ')[1];

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const apiKeyRecord = db.prepare(
    'SELECT * FROM api_keys WHERE (api_key = ? OR key_hash = ?) AND is_active = 1'
  ).get(token, tokenHash) as Record<string, unknown> | undefined;

  if (!apiKeyRecord) return res.status(403).json({ success: false, error: 'Invalid or revoked API Key' });

  (req as express.Request & { apiKeyRecord: Record<string, unknown> }).apiKeyRecord = apiKeyRecord;

  // Load user and package if key has a user_id
  if (apiKeyRecord.user_id) {
    const user = db.prepare('SELECT id, email, role, package_id, tokens_used, usd_spent, usage_reset_at, is_active FROM users WHERE id = ? AND is_active = 1').get(apiKeyRecord.user_id) as UserRow | undefined;
    if (user) {
      const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(user.package_id) as PackageRow | undefined;
      (req as express.Request & { proxyUser?: UserRow; proxyPackage?: PackageRow }).proxyUser = user;
      (req as express.Request & { proxyUser?: UserRow; proxyPackage?: PackageRow }).proxyPackage = pkg;
    }
  }

  next();
};

// ---- Middleware: Check monthly usage reset ----
// Returns the (possibly updated) user row — never mutates the input object.
function maybeResetUsage(user: UserRow): UserRow {
  if (!user.usage_reset_at) return user;
  const resetAt = new Date(user.usage_reset_at);
  if (new Date() < resetAt) return user;

  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1);
  nextReset.setDate(1);
  nextReset.setHours(0, 0, 0, 0);
  db.prepare('UPDATE users SET tokens_used = 0, usd_spent = 0, usage_reset_at = ? WHERE id = ?')
    .run(nextReset.toISOString().replace('T', ' ').slice(0, 19), user.id);
  return { ...user, tokens_used: 0, usd_spent: 0 };
}

// ---- Middleware: Enforce package limits ----
const enforcePackageLimits = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const r = req as express.Request & { proxyUser?: UserRow; proxyPackage?: PackageRow };
  const pkg = r.proxyPackage;
  if (!r.proxyUser || !pkg) return next(); // no user context → fall through to per-key limits

  const user = maybeResetUsage(r.proxyUser);
  r.proxyUser = user;

  // 1. Model access control
  const allowedModels: string[] = JSON.parse(pkg.allowed_models || '[]');
  const requestedModel = ((req.body as { model?: string }).model || '').toLowerCase();
  if (allowedModels.length > 0 && !allowedModels.some(m => requestedModel.includes(m))) {
    return res.status(403).json({
      success: false,
      error: `Your account does not have access to this model. Contact your administrator.`,
      code: 'MODEL_NOT_ALLOWED',
      allowed_models: allowedModels
    });
  }

  // 2. Token quota check
  if (pkg.token_quota > 0 && user.tokens_used >= pkg.token_quota) {
    return res.status(429).json({
      success: false,
      error: `Token quota exceeded. Your ${pkg.name} plan allows ${pkg.token_quota.toLocaleString()} tokens per month.`,
      code: 'QUOTA_EXCEEDED',
      tokens_used: user.tokens_used,
      token_quota: pkg.token_quota
    });
  }

  // 3. USD budget check
  if (pkg.usd_budget > 0 && user.usd_spent >= pkg.usd_budget) {
    return res.status(429).json({
      success: false,
      error: `Monthly budget exceeded. Your ${pkg.name} plan has a $${pkg.usd_budget} monthly limit.`,
      code: 'BUDGET_EXCEEDED',
      usd_spent: user.usd_spent,
      usd_budget: pkg.usd_budget
    });
  }

  // 4. RPM limit (use package limit, override per-key limit)
  const now = Date.now();
  const keyId = (req as express.Request & { apiKeyRecord: Record<string, unknown> }).apiKeyRecord.id as number;
  if (!rateLimitStore[keyId] || (now - rateLimitStore[keyId].windowStart > 60_000)) {
    rateLimitStore[keyId] = { rpmCount: 0, tpmCount: 0, windowStart: now };
  }
  const record = rateLimitStore[keyId];
  if (record.rpmCount >= pkg.rpm_limit) {
    return res.status(429).json({
      success: false,
      error: `Rate limit exceeded: ${pkg.rpm_limit} requests per minute on ${pkg.name} plan.`,
      code: 'RATE_LIMIT_RPM'
    });
  }
  record.rpmCount++;

  next();
};

// ---- Middleware: Per-key rate limiter (for keys without user context) ----
const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const r = req as express.Request & { proxyUser?: UserRow; apiKeyRecord: Record<string, unknown> };
  if (r.proxyUser) return next(); // package limits already applied above

  const key = r.apiKeyRecord;
  if (!key.rpm_limit && !key.tpm_limit) return next();

  const now = Date.now();
  const keyId = key.id as number;
  if (!rateLimitStore[keyId] || (now - rateLimitStore[keyId].windowStart > 60_000)) {
    rateLimitStore[keyId] = { rpmCount: 0, tpmCount: 0, windowStart: now };
  }
  const record = rateLimitStore[keyId];
  if ((key.rpm_limit as number) > 0 && record.rpmCount >= (key.rpm_limit as number)) {
    return res.status(429).json({ success: false, error: 'RPM limit exceeded', code: 'RATE_LIMIT_RPM' });
  }
  const estimatedTokens = JSON.stringify((req.body as { messages?: unknown[] }).messages || []).length / 4;
  if ((key.tpm_limit as number) > 0 && (record.tpmCount + estimatedTokens) > (key.tpm_limit as number)) {
    return res.status(429).json({ success: false, error: 'TPM limit exceeded', code: 'RATE_LIMIT_TPM' });
  }
  record.rpmCount++;
  record.tpmCount += estimatedTokens;
  next();
};

// ---- Alert & Webhook ----
async function checkBudgetAndAlert(apiKeyId: number, currentSpend: number, keyRecord: Record<string, unknown>) {
  if (!keyRecord.webhook_url || !keyRecord.budget) return;
  let thresholds: number[] = [80, 95];
  try { thresholds = JSON.parse(keyRecord.alert_thresholds as string); } catch { /* default */ }

  const budgetPct = (currentSpend / (keyRecord.budget as number)) * 100;
  const lastAlerted = (keyRecord.last_alert_percentage as number) || 0;
  const triggered = thresholds.filter(t => budgetPct >= t && lastAlerted < t).sort((a, b) => b - a)[0];
  if (triggered === undefined) return;

  try {
    await fetch(keyRecord.webhook_url as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'budget_alert', key_name: keyRecord.key_name,
        threshold_pct: triggered, spend_usd: currentSpend, budget_usd: keyRecord.budget,
        timestamp: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(5000)
    });
    db.prepare('UPDATE api_keys SET last_alert_percentage = ? WHERE id = ?').run(triggered, apiKeyId);
  } catch (e) {
    console.error('[Alert] Webhook failed:', e instanceof Error ? e.message : e);
  }
}

// ---- Streaming Proxy Handler ----
// Parses OpenAI-compatible SSE chunks and extracts usage from the final data chunk.
function parseUsageFromSSE(lines: string[]): { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') continue;
    try {
      const chunk = JSON.parse(data) as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
      if (chunk.usage?.total_tokens) {
        return {
          prompt_tokens: chunk.usage.prompt_tokens ?? 0,
          completion_tokens: chunk.usage.completion_tokens ?? 0,
          total_tokens: chunk.usage.total_tokens
        };
      }
    } catch { /* skip */ }
  }
  return null;
}

async function handleStreamRequest(
  req: express.Request,
  res: express.Response,
  apiKeyId: number,
  providerStr: string,
  proxyUserId: number | null,
  routerConfig: RouterEntry[] | null
): Promise<void> {
  try {
    const { stream, _provider, _latencyMs } = await SmartRouter.routeStream(req.body, providerStr, routerConfig);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const decoder = new TextDecoder();
    const collectedLines: string[] = [];
    let clientDisconnected = false;
    let readerReleased = false;

    const reader = stream.getReader();

    const cleanup = () => {
      if (!readerReleased) { readerReleased = true; reader.cancel().catch(() => { /* ignore */ }); }
    };
    req.on('close', () => { clientDisconnected = true; cleanup(); });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        collectedLines.push(...text.split('\n'));
        if (!clientDisconnected) res.write(text);
      }
    } finally {
      cleanup();
    }

    if (!clientDisconnected) res.end();

    // Always log to token_logs — use zero usage as fallback so the request is always recorded
    const usage = parseUsageFromSSE(collectedLines);
    const model = (req.body as { model?: string }).model || 'unknown';
    const prompt_tokens = usage?.prompt_tokens ?? 0;
    const completion_tokens = usage?.completion_tokens ?? 0;
    const total_tokens = usage?.total_tokens ?? 0;
    const costUsd = calculateCost(model, prompt_tokens, completion_tokens);
    db.prepare(
      'INSERT INTO token_logs (api_key_id, user_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(apiKeyId, proxyUserId, model, _provider, prompt_tokens, completion_tokens, total_tokens, costUsd, _latencyMs);
    if (proxyUserId && total_tokens > 0) {
      db.prepare('UPDATE users SET tokens_used = tokens_used + ?, usd_spent = usd_spent + ? WHERE id = ?')
        .run(total_tokens, costUsd, proxyUserId);
    }
  } catch (err: unknown) {
    if (!res.headersSent) {
      if (err instanceof RouterExhaustedError) {
        res.status(503).json({ success: false, error: 'All providers failed or do not support streaming', attempts: err.attempts });
      } else {
        // Log error type only — do not write upstream body to stderr (may contain provider account metadata)
        process.stderr.write(`[stream error] ${err instanceof Error ? err.constructor.name : 'UnknownError'}\n`);
        res.status(500).json({ success: false, error: 'Internal proxy error during streaming.' });
      }
    }
  }
}

// ---- Main Proxy Endpoint ----
app.post('/v1/chat/completions', authenticateAndLoadKey, enforcePackageLimits, rateLimiter,
  async (req: express.Request, res: express.Response) => {
    const r = req as express.Request & {
      apiKeyRecord: Record<string, unknown>;
      proxyUser?: UserRow;
      proxyPackage?: PackageRow;
    };
    const keyRecord = r.apiKeyRecord;
    const apiKeyId = keyRecord.id as number;
    const providerStr = ((keyRecord.provider as string) || 'openai').toLowerCase();

    // Check cache
    const promptHash = crypto.createHash('md5')
      .update(JSON.stringify((req.body as { messages?: unknown[] }).messages || []))
      .digest('hex');
    const cachedRow = db.prepare(
      `SELECT response_json FROM request_cache WHERE req_hash = ? AND expires_at > datetime('now')`
    ).get(promptHash) as { response_json: string } | undefined;

    if (cachedRow) {
      const cachedRes = JSON.parse(cachedRow.response_json);
      const savedCost = calculateCost(cachedRes.model, cachedRes.usage.prompt_tokens, cachedRes.usage.completion_tokens);
      db.prepare(
        'INSERT INTO token_logs (api_key_id, user_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, is_cached, cost_usd_saved) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 1, ?)'
      ).run(apiKeyId, r.proxyUser?.id ?? null, cachedRes.model, providerStr, savedCost);
      return res.json({ ...cachedRes, cached: true, saved_usd: savedCost });
    }

    try {
      const routerConfig: RouterEntry[] | null = keyRecord.router_config
        ? JSON.parse(keyRecord.router_config as string) : null;

      // Branch: streaming request
      if ((req.body as { stream?: boolean }).stream === true) {
        return await handleStreamRequest(req, res, apiKeyId, providerStr, r.proxyUser?.id ?? null, routerConfig);
      }

      const response = await SmartRouter.route(req.body, providerStr, routerConfig);
      const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
      const costUsd = calculateCost(response.model, prompt_tokens, completion_tokens);
      const usedProvider = response._provider || providerStr;
      const latencyMs = response._latencyMs ?? 0;

      db.prepare(
        'INSERT INTO token_logs (api_key_id, user_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(apiKeyId, r.proxyUser?.id ?? null, response.model, usedProvider, prompt_tokens, completion_tokens, total_tokens, costUsd, latencyMs);

      // Update user usage counters
      if (r.proxyUser) {
        db.prepare('UPDATE users SET tokens_used = tokens_used + ?, usd_spent = usd_spent + ? WHERE id = ?')
          .run(total_tokens, costUsd, r.proxyUser.id);
      }

      // Cache response (TTL 1 hour)
      const expiresAt = new Date(Date.now() + 3600_000).toISOString().replace('T', ' ').slice(0, 19);
      db.prepare('INSERT OR REPLACE INTO request_cache (req_hash, response_json, expires_at) VALUES (?, ?, ?)')
        .run(promptHash, JSON.stringify(response), expiresAt);

      const totalSpend = (db.prepare('SELECT SUM(cost_usd) as t FROM token_logs WHERE api_key_id = ?').get(apiKeyId) as { t: number | null }).t ?? 0;
      checkBudgetAndAlert(apiKeyId, totalSpend, keyRecord);

      const { _provider, _latencyMs, ...cleanResponse } = response;
      void _provider; void _latencyMs;
      return res.json(cleanResponse);
    } catch (err: unknown) {
      if (err instanceof RouterExhaustedError) {
        return res.status(503).json({ success: false, error: 'All providers failed', attempts: err.attempts });
      }
      process.stderr.write(`[proxy error] ${err instanceof Error ? err.message : String(err)}\n`);
      return res.status(500).json({ success: false, error: 'Internal proxy error. Please try again.' });
    }
  });

// ---- Public auth routes ----
app.use('/auth', authRouter);

// ---- Management routes (open — self-hosted, protect via network/firewall) ----
app.use('/api/keys', keysRouter);
app.use('/api/stats', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`TokenGuard running on port ${PORT}`);
  console.log(`Providers: openai, anthropic, gemini, groq, azure, cohere, mistral, bedrock`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
