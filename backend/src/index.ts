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

const authenticateProxy = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const token = authHeader.split(' ')[1];
  const stmt = db.prepare('SELECT id, provider, budget, project_id FROM api_keys WHERE api_key = ?');
  const apiKeyRecord = stmt.get(token) as { id: number, provider: string, budget: number, project_id: string } | undefined;
  
  if (!apiKeyRecord) {
    res.status(403).json({ error: 'Invalid API Key' });
    return;
  }
  
  (req as any).apiKeyId = apiKeyRecord.id;
  (req as any).provider = (apiKeyRecord.provider || 'openai').toLowerCase();
  (req as any).budget = apiKeyRecord.budget;
  (req as any).projectId = apiKeyRecord.project_id;
  
  next();
};

app.post('/v1/chat/completions', authenticateProxy, async (req: express.Request, res: express.Response) => {
  try {
    const providerStr = (req as any).provider;
    const apiKeyId = (req as any).apiKeyId;
    const body = req.body;
    let targetModel = body.model || 'gpt-3.5-turbo';
    
    // Check if adapter exists
    const adapter = ProviderRegistry[providerStr];
    if (!adapter) {
      return res.status(400).json({ error: { message: `Unsupported provider: ${providerStr}` } });
    }
    
    // Get actual API key from ENV based on provider
    const envKeyName = `${providerStr.toUpperCase()}_API_KEY`;
    const providerApiKey = process.env[envKeyName];
    if (!providerApiKey) {
      return res.status(500).json({ error: { message: `Missing ${envKeyName} in server configuration.` } });
    }

    // Process via Adapter
    const response = await adapter.chatCompletion(body, providerApiKey);
    
    // Extract usage and calculate cost
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
    const costUsd = calculateCost(response.model, prompt_tokens, completion_tokens);
    
    // Save to Database
    const stmt = db.prepare(`
      INSERT INTO token_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(apiKeyId, response.model, prompt_tokens, completion_tokens, total_tokens, costUsd);
    
    return res.json(response);

  } catch (error: any) {
    console.error('Unified API Error:', error);
    res.status(500).json({ error: { message: error.message || 'Internal Server Error' } });
  }
});

// --- API Endpoints ---
app.get('/api/keys', (req, res) => {
  const stmt = db.prepare('SELECT id, key_name, api_key, provider, budget, project_id, created_at FROM api_keys ORDER BY created_at DESC');
  const keys = stmt.all() as any[];
  
  const formattedKeys = keys.map(k => ({
    id: k.id,
    name: k.key_name,
    provider: k.provider ? k.provider.charAt(0).toUpperCase() + k.provider.slice(1).toLowerCase() : 'OpenAI',
    prefix: k.api_key.substring(0, 7) + '...',
    budget: k.budget,
    project_id: k.project_id,
    created: k.created_at.split(' ')[0]
  }));
  
  res.json(formattedKeys);
});

app.post('/api/keys', (req, res) => {
  const { name, provider, budget, project_id } = req.body;
  const key_name = name || req.body.key_name;
  
  if (!key_name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  
  const prov = provider ? provider.toLowerCase() : 'openai';
  const budg = budget || 0;
  const proj = project_id || null;
  const newKey = 'tg-' + crypto.randomBytes(16).toString('hex');
  const stmt = db.prepare('INSERT INTO api_keys (key_name, api_key, provider, budget, project_id) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(key_name, newKey, prov, budg, proj);
  
  res.json({ id: result.lastInsertRowid, name: key_name, provider: prov, api_key: newKey, budget: budg, project_id: proj });
});

app.delete('/api/keys/:id', (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

app.get('/api/stats/token-usage', (req, res) => {
  const stmt = db.prepare(`
    SELECT k.provider, date(t.created_at) as date, SUM(t.total_tokens) as tokens, SUM(t.cost_usd) as cost
    FROM token_logs t
    JOIN api_keys k ON t.api_key_id = k.id
    GROUP BY k.provider, date(t.created_at)
    ORDER BY date ASC
  `);
  
  const logs = stmt.all() as any[];
  const stats: Record<string, { tokens: number[], cost: number[] }> = {
    OpenAI: { tokens: [], cost: [] },
    Gemini: { tokens: [], cost: [] },
    Anthropic: { tokens: [], cost: [] },
    Groq: { tokens: [], cost: [] }
  };
  
  logs.forEach(log => {
    const prov = log.provider.toLowerCase();
    const providerCapitalized = prov.charAt(0).toUpperCase() + prov.slice(1);
    
    if (!stats[providerCapitalized]) {
      stats[providerCapitalized] = { tokens: [], cost: [] };
    }
    
    stats[providerCapitalized].tokens.push(log.tokens);
    stats[providerCapitalized].cost.push(log.cost || 0);
  });
  
  res.json(stats);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SOMA TOKEN MONITORING SYSTEM Proxy Backend Phase 2' });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
});
