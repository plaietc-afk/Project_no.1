import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// Note: Intentionally not parsing JSON bodies globally because proxy middleware needs raw streams

// Dummy proxy route for OpenAI
app.use(
  '/v1/chat/completions',
  createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      console.log('Intercepted request to:', req.url);
      // Day 2: Implement token tracking logic here
    },
    onProxyRes: (proxyRes, req, res) => {
      // Day 2: Implement response interception here
    }
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SOMA TOKEN MONITORING SYSTEM Proxy Backend' });
});

app.listen(PORT, () => {
  console.log(`🚀 SOMA TOKEN MONITORING SYSTEM Proxy running on http://localhost:${PORT}`);
});
