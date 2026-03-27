import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import db from './db';
import { calculateCost } from './pricing';
import { ProviderRegistry } from './providers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- Alert & Webhook Logic ---
async function checkBudgetAndAlert(apiKeyId: number) {
  try {
    const keyStmt = db.prepare('SELECT project_id, budget, webhook_url, alert_thresholds, last_alert_percentage FROM api_keys WHERE id = ?');
    const keyInfo = keyStmt.get(apiKeyId) as { project_id: string, budget: number, webhook_url: string, alert_thresholds: string, last_alert_percentage: number } | undefined;

    if (!keyInfo || !keyInfo.webhook_url || keyInfo.budget <= 0) {
      return; // No webhook URL or budget set, so nothing to do.
    }

    const costStmt = db.prepare('SELECT SUM(cost_usd) as total_cost FROM token_logs WHERE api_key_id = ?');
    const { total_cost } = costStmt.get(apiKeyId) as { total_cost: number };

    const usagePercentage = (total_cost / keyInfo.budget) * 100;
    const thresholds: number[] = JSON.parse(keyInfo.alert_thresholds || '[80, 95]');
    let newAlertPercentage = keyInfo.last_alert_percentage;

    for (const threshold of thresholds) {
      if (usagePercentage >= threshold && keyInfo.last_alert_percentage < threshold) {
        // Fire webhook!
        console.log(`[ALERT] Firing webhook for key ${apiKeyId}. Budget usage ${usagePercentage.toFixed(2)}% has passed ${threshold}% threshold.`);
        
        const payload = {
          event: 'budget_alert',
          project_id: keyInfo.project_id || 'N/A',
          api_key_id: apiKeyId,
          budget_usd: keyInfo.budget,
          current_spend_usd: total_cost,
          usage_percentage: usagePercentage,
          threshold_triggered: threshold,
          message: `Budget Alert: Your project has used ${usagePercentage.toFixed(2)}% of its budget, passing the ${threshold}% threshold.`
        };

        fetch(keyInfo.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(err => console.error(`[ALERT] Failed to send webhook for key ${apiKeyId}:`, err));
        
        // Update the last alert percentage to the current threshold to prevent re-firing
        newAlertPercentage = threshold;
      }
    }

    if (newAlertPercentage !== keyInfo.last_alert_percentage) {
      const updateStmt = db.prepare('UPDATE api_keys SET last_alert_percentage = ? WHERE id = ?');
      updateStmt.run(newAlertPercentage, apiKeyId);
    }

  } catch (error) {
    console.error('[ALERT] Error in checkBudgetAndAlert:', error);
  }
}

const authenticateProxy = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = authHeader.split(' ')[1];
  const stmt = db.prepare('SELECT id, provider FROM api_keys WHERE api_key = ?');
  const apiKeyRecord = stmt.get(token) as { id: number, provider: string } | undefined;
  if (!apiKeyRecord) return res.status(403).json({ error: 'Invalid API Key' });
  (req as any).apiKeyId = apiKeyRecord.id;
  (req as any).provider = (apiKeyRecord.provider || 'openai').toLowerCase();
  next();
};

app.post('/v1/chat/completions', authenticateProxy, async (req: express.Request, res: express.Response) => {
  try {
    const apiKeyId = (req as any).apiKeyId;
    const body = req.body;
    
    // --- CACHE LAYER ---
    const reqBodyString = JSON.stringify({ model: body.model, messages: body.messages, temperature: body.temperature, max_tokens: body.max_tokens, provider: (req as any).provider });
    const reqHash = crypto.createHash('sha256').update(reqBodyString).digest('hex');
    const cacheStmt = db.prepare('SELECT response_json FROM request_cache WHERE req_hash = ? AND expires_at > datetime("now")');
    const cachedRecord = cacheStmt.get(reqHash) as { response_json: string } | undefined;

    if (cachedRecord) {
      const cachedResponse = JSON.parse(cachedRecord.response_json);
      const { prompt_tokens, completion_tokens, total_tokens } = cachedResponse.usage;
      const costUsdSaved = calculateCost(cachedResponse.model, prompt_tokens, completion_tokens);
      db.prepare('INSERT INTO token_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, is_cached, cost_usd_saved) VALUES (?, ?, ?, ?, ?, ?, 1, ?)').run(apiKeyId, cachedResponse.model, prompt_tokens, completion_tokens, total_tokens, 0, costUsdSaved);
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }
    
    // --- CACHE MISS: Proceed to Provider ---
    const providerStr = (req as any).provider;
    const adapter = ProviderRegistry[providerStr];
    if (!adapter) return res.status(400).json({ error: { message: `Unsupported provider: ${providerStr}` } });

    const envKeyName = `${providerStr.toUpperCase()}_API_KEY`;
    const providerApiKey = process.env[envKeyName];
    if (!providerApiKey) return res.status(500).json({ error: { message: `Missing ${envKeyName} in server configuration.` } });

    const response = await adapter.chatCompletion(body, providerApiKey);
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
    const costUsd = calculateCost(response.model, prompt_tokens, completion_tokens);

    db.prepare('INSERT INTO token_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)').run(apiKeyId, response.model, prompt_tokens, completion_tokens, total_tokens, costUsd);
    db.prepare('INSERT OR REPLACE INTO request_cache (req_hash, response_json, expires_at) VALUES (?, ?, datetime("now", "+1 day"))').run(reqHash, JSON.stringify(response));
    
    res.setHeader('X-Cache', 'MISS');
    res.json(response);

    // Check for alerts AFTER sending the response
    checkBudgetAndAlert(apiKeyId);

  } catch (error: any) {
    console.error('Unified API Error:', error);
    res.status(500).json({ error: { message: error.message || 'Internal Server Error' } });
  }
});

// --- API Endpoints ---
app.get('/api/keys', (req, res) => {
  const keys = db.prepare('SELECT id, key_name, api_key, provider, budget, project_id, webhook_url, alert_thresholds, last_alert_percentage, created_at FROM api_keys ORDER BY created_at DESC').all() as any[];
  res.json(keys);
});

app.post('/api/keys', (req, res) => {
  const { name, provider, budget, project_id, webhook_url, alert_thresholds } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const newKey = 'tg-' + crypto.randomBytes(16).toString('hex');
  const result = db.prepare('INSERT INTO api_keys (key_name, api_key, provider, budget, project_id, webhook_url, alert_thresholds) VALUES (?, ?, ?, ?, ?, ?, ?)').run(name, newKey, provider || 'openai', budget || 0, project_id, webhook_url, JSON.stringify(alert_thresholds || [80, 95]));
  res.json({ id: result.lastInsertRowid, api_key: newKey, ...req.body });
});

app.put('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  const { name, provider, budget, project_id, webhook_url, alert_thresholds } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  db.prepare('UPDATE api_keys SET key_name = ?, provider = ?, budget = ?, project_id = ?, webhook_url = ?, alert_thresholds = ? WHERE id = ?').run(name, provider, budget, project_id, webhook_url, JSON.stringify(alert_thresholds), id);
  res.json({ success: true, ...req.body });
});

app.delete('/api/keys/:id', (req, res) => {
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/stats/token-usage', (req, res) => {
  const logs = db.prepare('SELECT k.provider, date(t.created_at) as date, SUM(t.total_tokens) as tokens, SUM(t.cost_usd) as cost, SUM(t.cost_usd_saved) as saved FROM token_logs t JOIN api_keys k ON t.api_key_id = k.id GROUP BY k.provider, date(t.created_at) ORDER BY date ASC').all() as any[];
  const stats = logs.reduce((acc, log) => {
    const prov = log.provider.charAt(0).toUpperCase() + log.provider.slice(1);
    if (!acc[prov]) acc[prov] = { tokens: [], cost: [], saved: [] };
    acc[prov].tokens.push(log.tokens);
    acc[prov].cost.push(log.cost || 0);
    acc[prov].saved.push(log.saved || 0);
    return acc;
  }, {});
  const totalSaved = (db.prepare('SELECT SUM(cost_usd_saved) as total FROM token_logs').get() as any).total || 0;
  res.json({ providers: stats, global: { total_cost_saved_usd: totalSaved } });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SOMA TOKEN MONITORING SYSTEM Proxy Backend Phase 3' });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
});
