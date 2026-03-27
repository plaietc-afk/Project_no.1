import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import db from './db';
import { calculateCost } from './pricing';
import { ProviderRegistry } from './providers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- In-Memory Store for Rate Limiting ---
// Note: In production, a more persistent store like Redis would be better.
interface RateLimitRecord {
  rpmCount: number;
  tpmCount: number;
  windowStart: number;
}
const rateLimitStore: Record<number, RateLimitRecord> = {};

// --- Middleware ---
const authenticateAndLoadKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = authHeader.split(' ')[1];
  
  const stmt = db.prepare('SELECT * FROM api_keys WHERE api_key = ?');
  const apiKeyRecord = stmt.get(token) as any;

  if (!apiKeyRecord) return res.status(403).json({ error: 'Invalid API Key' });
  
  (req as any).apiKeyRecord = apiKeyRecord;
  next();
};

const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const key = (req as any).apiKeyRecord;
  if (!key || (!key.rpm_limit && !key.tpm_limit)) {
    return next(); // No limits set for this key
  }

  const now = Date.now();
  const windowSizeMs = 60000; // 1 minute

  if (!rateLimitStore[key.id] || (now - rateLimitStore[key.id].windowStart > windowSizeMs)) {
    rateLimitStore[key.id] = { rpmCount: 0, tpmCount: 0, windowStart: now };
  }

  const record = rateLimitStore[key.id];

  // Check RPM
  if (key.rpm_limit > 0 && record.rpmCount >= key.rpm_limit) {
    return res.status(429).json({ error: `RPM limit of ${key.rpm_limit} exceeded.` });
  }

  // Check TPM (based on prompt tokens in this request)
  const estimatedPromptTokens = JSON.stringify(req.body.messages).length / 4; // Rough estimation
  if (key.tpm_limit > 0 && (record.tpmCount + estimatedPromptTokens) > key.tpm_limit) {
    return res.status(429).json({ error: `TPM limit of ${key.tpm_limit} exceeded.` });
  }

  // Increment counts
  record.rpmCount++;
  record.tpmCount += estimatedPromptTokens;
  
  next();
};

// --- Alert & Webhook Logic ---
// ... (omitted for brevity, assume it exists from previous step)
async function checkBudgetAndAlert(apiKeyId: number) { /* ... */ }

app.post('/v1/chat/completions', authenticateAndLoadKey, rateLimiter, async (req: express.Request, res: express.Response) => {
  const keyRecord = (req as any).apiKeyRecord;
  const apiKeyId = keyRecord.id;
  const providerStr = (keyRecord.provider || 'openai').toLowerCase();
  
  // Cache check, adapter logic, etc. as before
  // ...
  
  // (Simplified for this example, assuming full logic from previous step is here)
  try {
    const body = req.body;
    const adapter = ProviderRegistry[providerStr];
    const envKeyName = `${providerStr.toUpperCase()}_API_KEY`;
    const providerApiKey = process.env[envKeyName];
    
    if (!adapter || !providerApiKey) {
        throw new Error("Provider not supported or API key missing");
    }

    const response = await adapter.chatCompletion(body, providerApiKey);
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
    const costUsd = calculateCost(response.model, prompt_tokens, completion_tokens);

    db.prepare('INSERT INTO token_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)').run(apiKeyId, response.model, prompt_tokens, completion_tokens, total_tokens, costUsd);
    
    // After a successful response, decrement TPM count for next request
    // This isn't perfect but prevents prompts from getting stuck if they are large
    const estimatedPromptTokens = JSON.stringify(req.body.messages).length / 4;
    if (rateLimitStore[apiKeyId]) {
      rateLimitStore[apiKeyId].tpmCount -= estimatedPromptTokens;
    }

    res.json(response);
    checkBudgetAndAlert(apiKeyId);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- API Endpoints ---
app.get('/api/keys', (req, res) => {
  const keys = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all();
  res.json(keys);
});

app.post('/api/keys', (req, res) => {
  const { name, provider, budget, project_id, webhook_url, alert_thresholds, rpm_limit, tpm_limit } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const newKey = 'tg-' + crypto.randomBytes(16).toString('hex');
  const result = db.prepare('INSERT INTO api_keys (key_name, api_key, provider, budget, project_id, webhook_url, alert_thresholds, rpm_limit, tpm_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, newKey, provider || 'openai', budget || 0, project_id, webhook_url, JSON.stringify(alert_thresholds || [80, 95]), rpm_limit || 0, tpm_limit || 0);
  res.json({ id: result.lastInsertRowid, api_key: newKey, ...req.body });
});

app.put('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  const { name, provider, budget, project_id, webhook_url, alert_thresholds, rpm_limit, tpm_limit } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  db.prepare('UPDATE api_keys SET key_name = ?, provider = ?, budget = ?, project_id = ?, webhook_url = ?, alert_thresholds = ?, rpm_limit = ?, tpm_limit = ? WHERE id = ?').run(name, provider, budget, project_id, webhook_url, JSON.stringify(alert_thresholds), rpm_limit, tpm_limit, id);
  res.json({ success: true });
});

app.delete('/api/keys/:id', (req, res) => {
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Other endpoints...

app.listen(PORT, () => {
  console.log(`🚀 Proxy Server with Rate Limiting running on http://localhost:${PORT}`);
});
