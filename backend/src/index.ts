import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import crypto from 'crypto';
import db from './db';

dotenv.config();

// Bug 2: Missing Validation - Check for API KEYS early
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ FATAL ERROR: OPENAI_API_KEY is missing in environment variables (.env).');
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ FATAL ERROR: GEMINI_API_KEY is missing in environment variables (.env).');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// Raw parser for proxy matching
const rawBodySaver = (req: any, res: any, buf: Buffer, encoding: string) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString((encoding as BufferEncoding) || 'utf8');
  }
};
// Apply json parser only to /api routes so we don't consume the body for the proxy
app.use("/api", express.json({ verify: rawBodySaver }));

// Helper to authenticate requests to Proxy
const authenticateProxy = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const token = authHeader.split(' ')[1];
  const stmt = db.prepare('SELECT id, provider FROM api_keys WHERE api_key = ?');
  const apiKeyRecord = stmt.get(token) as { id: number, provider: string } | undefined;
  
  if (!apiKeyRecord) {
    res.status(403).json({ error: 'Invalid API Key' });
    return;
  }
  
  const provider = (apiKeyRecord.provider || 'openai').toLowerCase();
  (req as any).apiKeyId = apiKeyRecord.id;
  (req as any).provider = provider;
  
  if (provider === 'gemini') {
    req.headers.authorization = `Bearer ${process.env.GEMINI_API_KEY}`;
  } else {
    req.headers.authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }
  
  next();
};

app.post(
  '/v1/chat/completions',
  authenticateProxy,
  createProxyMiddleware({
    target: 'https://api.openai.com',
    router: (req: any) => {
      if (req.provider === 'gemini') {
        return 'https://generativelanguage.googleapis.com';
      }
      return 'https://api.openai.com';
    },
    pathRewrite: (path: string, req: any) => {
      if (req.provider === 'gemini') {
        return path.replace('/v1/chat/completions', '/v1beta/openai/chat/completions');
      }
      return path;
    },
    changeOrigin: true,
    selfHandleResponse: true,
    on: {
      proxyReq: (proxyReq: any, req: any, res: any) => {
        console.log(`Intercepted request to: ${proxyReq.host}${proxyReq.path} (Provider: ${req.provider})`);
      },
      proxyRes: responseInterceptor(async (responseBuffer: Buffer, proxyRes: any, req: any, res: any) => {
        const response = responseBuffer.toString('utf8');
        try {
          const parsed = JSON.parse(response);
          if (parsed.usage) {
            const { prompt_tokens, completion_tokens, total_tokens } = parsed.usage;
            const model = parsed.model || 'unknown';
            const apiKeyId = (req as any).apiKeyId;
            
            const stmt = db.prepare(`
              INSERT INTO token_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens)
              VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(apiKeyId, model, prompt_tokens, completion_tokens, total_tokens);
            console.log(`Saved token usage for model ${model}: ${total_tokens} total tokens`);
          }
        } catch (e) {
          console.error('Error parsing response', e);
        }
        return responseBuffer;
      })
    }
  })
);

// --- API Endpoints ---
app.get('/api/keys', (req, res) => {
  const stmt = db.prepare('SELECT id, key_name, api_key, provider, created_at FROM api_keys ORDER BY created_at DESC');
  const keys = stmt.all() as any[];
  
  const formattedKeys = keys.map(k => ({
    id: k.id,
    name: k.key_name,
    provider: k.provider ? k.provider.charAt(0).toUpperCase() + k.provider.slice(1).toLowerCase() : 'OpenAI',
    prefix: k.api_key.substring(0, 7) + '...',
    created: k.created_at.split(' ')[0] // Simple date extract
  }));
  
  res.json(formattedKeys); // Frontend expects array directly based on Handover
});

app.post('/api/keys', (req, res) => {
  const { name, provider } = req.body;
  const key_name = name || req.body.key_name; // Fallback for old frontend
  
  if (!key_name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  
  const prov = provider ? provider.toLowerCase() : 'openai';
  const newKey = 'tg-' + crypto.randomBytes(16).toString('hex');
  const stmt = db.prepare('INSERT INTO api_keys (key_name, api_key, provider) VALUES (?, ?, ?)');
  const result = stmt.run(key_name, newKey, prov);
  
  res.json({ id: result.lastInsertRowid, name: key_name, provider: prov, api_key: newKey });
});

app.delete('/api/keys/:id', (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

// Stats endpoint
app.get('/api/stats/token-usage', (req, res) => {
  // Return mock data for now, or aggregate from DB
  const stmt = db.prepare(`
    SELECT k.provider, date(t.created_at) as date, SUM(t.total_tokens) as tokens
    FROM token_logs t
    JOIN api_keys k ON t.api_key_id = k.id
    GROUP BY k.provider, date(t.created_at)
    ORDER BY date ASC
  `);
  
  const logs = stmt.all() as any[];
  const stats: Record<string, number[]> = {
    OpenAI: [],
    Gemini: []
  };
  
  // A simple group logic for frontend requirement
  // For production, we would map dates continuously, but for now we just return arrays
  const openAITokens: number[] = [];
  const geminiTokens: number[] = [];
  
  logs.forEach(log => {
    const prov = log.provider.toLowerCase();
    if (prov === 'openai') openAITokens.push(log.tokens);
    if (prov === 'gemini') geminiTokens.push(log.tokens);
  });
  
  // If no data, return some defaults so frontend can test
  if (openAITokens.length === 0) {
    stats.OpenAI = [0, 0, 0, 0, 0, 0, 0];
  } else {
    stats.OpenAI = openAITokens;
  }
  
  if (geminiTokens.length === 0) {
    stats.Gemini = [0, 0, 0, 0, 0, 0, 0];
  } else {
    stats.Gemini = geminiTokens;
  }
  
  res.json(stats);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SOMA TOKEN MONITORING SYSTEM Proxy Backend' });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
});
