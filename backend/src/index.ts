import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import crypto from 'crypto';
import db from './db';

dotenv.config();

// Bug 2: Missing Validation - Check for OPENAI_API_KEY early
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ FATAL ERROR: OPENAI_API_KEY is missing in environment variables (.env).');
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
app.use("/api", express.json({ verify: rawBodySaver }));

// Helper to authenticate requests to Proxy
const authenticateProxy = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const token = authHeader.split(' ')[1];
  const stmt = db.prepare('SELECT id FROM api_keys WHERE api_key = ?');
  const apiKeyRecord = stmt.get(token) as { id: number } | undefined;
  
  if (!apiKeyRecord) {
    res.status(403).json({ error: 'Invalid API Key' });
    return;
  }
  (req as any).apiKeyId = apiKeyRecord.id;
  
  // Replace auth header with real OpenAI API Key from ENV
  req.headers.authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  next();
};

// Bug 1: Fix proxy routing by using app.post instead of app.use, 
// so Express doesn't strip the '/v1/chat/completions' mount path from req.url
app.post(
  '/v1/chat/completions',
  authenticateProxy,
  createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    selfHandleResponse: true,
    on: {
      proxyReq: (proxyReq: any, req: any, res: any) => {
        console.log('Intercepted request to:', proxyReq.path);
        console.log('Request body size:', req.headers['content-length'] || 0, 'bytes');
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
          console.error('Error parsing OpenAI response', e);
        }
        return responseBuffer;
      })
    }
  })
);

// --- API Endpoints ---
app.get('/api/keys', (req, res) => {
  const stmt = db.prepare('SELECT id, key_name, api_key, created_at FROM api_keys ORDER BY created_at DESC');
  const keys = stmt.all();
  res.json({ keys });
});

app.post('/api/keys', (req, res) => {
  const { key_name } = req.body;
  if (!key_name) {
    res.status(400).json({ error: 'key_name is required' });
    return;
  }
  
  const newKey = 'tg-' + crypto.randomBytes(16).toString('hex');
  const stmt = db.prepare('INSERT INTO api_keys (key_name, api_key) VALUES (?, ?)');
  const result = stmt.run(key_name, newKey);
  
  res.json({ id: result.lastInsertRowid, key_name, api_key: newKey });
});

app.delete('/api/keys/:id', (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SOMA TOKEN MONITORING SYSTEM Proxy Backend' });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy Server running on http://localhost:${PORT}`);
});
