import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import db from './db';
import { calculateCost } from './pricing';
import { ProviderRegistry } from './providers';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- In-Memory Store for Rate Limiting & Caching ---
interface RateLimitRecord { rpmCount: number; tpmCount: number; windowStart: number; }
const rateLimitStore: Record<number, RateLimitRecord> = {};
const responseCache = new Map<string, any>(); // Simple prompt cache

// --- Middleware ---
const authenticateAndLoadKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = authHeader.split(' ')[1];
  const apiKeyRecord = db.prepare('SELECT * FROM api_keys WHERE api_key = ?').get(token) as any;
  if (!apiKeyRecord) return res.status(403).json({ error: 'Invalid API Key' });
  (req as any).apiKeyRecord = apiKeyRecord;
  next();
};

const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const key = (req as any).apiKeyRecord;
  if (!key || (!key.rpm_limit && !key.tpm_limit)) return next();
  const now = Date.now();
  if (!rateLimitStore[key.id] || (now - rateLimitStore[key.id].windowStart > 60000)) {
    rateLimitStore[key.id] = { rpmCount: 0, tpmCount: 0, windowStart: now };
  }
  const record = rateLimitStore[key.id];
  if (key.rpm_limit > 0 && record.rpmCount >= key.rpm_limit) return res.status(429).json({ error: `RPM limit exceeded.` });
  const estimatedPromptTokens = JSON.stringify(req.body.messages || []).length / 4;
  if (key.tpm_limit > 0 && (record.tpmCount + estimatedPromptTokens) > key.tpm_limit) return res.status(429).json({ error: `TPM limit exceeded.` });
  record.rpmCount++;
  record.tpmCount += estimatedPromptTokens;
  next();
};

// --- Alert & Webhook Logic ---
async function checkBudgetAndAlert(apiKeyId: number, currentSpend: number, keyRecord: any) {
  if (!keyRecord.webhook_url || !keyRecord.budget) return;
  const threshold = (keyRecord.alert_thresholds ? JSON.parse(keyRecord.alert_thresholds)[0] : 80) / 100;
  if (currentSpend >= keyRecord.budget * threshold) {
    try {
      await axios.post(keyRecord.webhook_url, {
        message: `🚨 ALERT: API Key ${keyRecord.key_name} has reached ${threshold * 100}% of its budget!`,
        spend: currentSpend, budget: keyRecord.budget
      });
      console.log(`Alert sent to ${keyRecord.webhook_url}`);
    } catch (e) { console.error("Failed to send webhook"); }
  }
}

app.post('/v1/chat/completions', authenticateAndLoadKey, rateLimiter, async (req: express.Request, res: express.Response) => {
  const keyRecord = (req as any).apiKeyRecord;
  const apiKeyId = keyRecord.id;
  const providerStr = (keyRecord.provider || 'openai').toLowerCase();
  
  // 1. Check Cache
  const promptHash = crypto.createHash('md5').update(JSON.stringify(req.body.messages || [])).digest('hex');
  if (responseCache.has(promptHash)) {
    const cachedRes = responseCache.get(promptHash);
    const savedCost = calculateCost(cachedRes.model, cachedRes.usage.prompt_tokens, cachedRes.usage.completion_tokens);
    db.prepare('INSERT INTO token_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, is_cached) VALUES (?, ?, ?, ?, ?, ?, 1)').run(apiKeyId, cachedRes.model, 0, 0, 0, 0); // Cost is 0 since cached
    return res.json({ ...cachedRes, cached: true, saved_usd: savedCost });
  }
  
  try {
    const adapter = ProviderRegistry[providerStr];
    const providerApiKey = process.env[`${providerStr.toUpperCase()}_API_KEY`];
    if (!adapter || !providerApiKey) throw new Error("Provider not supported or API key missing");

    const response = await adapter.chatCompletion(req.body, providerApiKey);
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
    const costUsd = calculateCost(response.model, prompt_tokens, completion_tokens);

    db.prepare('INSERT INTO token_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)').run(apiKeyId, response.model, prompt_tokens, completion_tokens, total_tokens, costUsd);
    
    // Save to Cache
    responseCache.set(promptHash, response);
    
    const totalSpend = db.prepare('SELECT SUM(cost_usd) as total FROM token_logs WHERE api_key_id = ?').get(apiKeyId) as any;
    checkBudgetAndAlert(apiKeyId, totalSpend.total || 0, keyRecord);
    
    if (rateLimitStore[apiKeyId]) rateLimitStore[apiKeyId].tpmCount -= (JSON.stringify(req.body.messages || []).length / 4);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Proxy Server with Caching, Alerts & Rate Limiting running on port ${PORT}`));
