require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase, getDb, saveDatabase } = require('./database');
const { generateToken, authMiddleware, adminOnly } = require('./auth');
const { proxyOpenAI, proxyAnthropic, proxyGemini } = require('./proxy');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from client build
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// ===== AUTH ROUTES =====
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDb();
  const result = db.exec("SELECT * FROM users WHERE username = ?", [username]);
  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const user = {};
  cols.forEach((col, i) => user[col] = row[i]);

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.exec("SELECT id, username, display_name, role FROM users WHERE id = ?", [req.user.id]);
  if (result.length === 0) return res.status(404).json({ error: 'User not found' });
  const cols = result[0].columns;
  const row = result[0].values[0];
  const user = {};
  cols.forEach((col, i) => user[col] = row[i]);
  res.json(user);
});

// ===== USER MANAGEMENT (Admin) =====
app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  const result = db.exec("SELECT id, username, display_name, role, created_at FROM users ORDER BY id");
  if (result.length === 0) return res.json([]);
  const cols = result[0].columns;
  res.json(result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  }));
});

app.post('/api/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password, display_name, role } = req.body;
  const db = getDb();
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)",
      [username, hash, display_name || username, role || 'viewer']);
    saveDatabase();
    res.json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.delete('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  db.run("DELETE FROM users WHERE id = ? AND role != 'admin'", [req.params.id]);
  saveDatabase();
  res.json({ message: 'User deleted' });
});

// ===== PROVIDER ROUTES =====
app.get('/api/providers', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.exec("SELECT id, name, slug, base_url, is_active, monthly_budget, created_at FROM providers ORDER BY id");
  if (result.length === 0) return res.json([]);
  const cols = result[0].columns;
  res.json(result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  }));
});

app.put('/api/providers/:id', authMiddleware, adminOnly, (req, res) => {
  const { api_key, is_active, monthly_budget } = req.body;
  const db = getDb();
  if (api_key !== undefined) {
    db.run("UPDATE providers SET api_key_encrypted = ? WHERE id = ?", [api_key, req.params.id]);
  }
  if (is_active !== undefined) {
    db.run("UPDATE providers SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, req.params.id]);
  }
  if (monthly_budget !== undefined) {
    db.run("UPDATE providers SET monthly_budget = ? WHERE id = ?", [monthly_budget, req.params.id]);
  }
  saveDatabase();
  res.json({ message: 'Provider updated' });
});

app.get('/api/providers/:id/has-key', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.exec("SELECT api_key_encrypted FROM providers WHERE id = ?", [req.params.id]);
  if (result.length === 0) return res.json({ hasKey: false });
  const key = result[0].values[0][0];
  res.json({ hasKey: !!key && key.length > 0 });
});

// ===== USAGE / DASHBOARD ROUTES =====
app.get('/api/dashboard/summary', authMiddleware, (req, res) => {
  const db = getDb();
  const { days = 30 } = req.query;

  // Total usage
  const totalResult = db.exec(`
    SELECT
      COALESCE(SUM(input_tokens), 0) as total_input,
      COALESCE(SUM(output_tokens), 0) as total_output,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(cost), 0) as total_cost,
      COUNT(*) as total_requests
    FROM usage_logs
    WHERE created_at >= datetime('now', '-${parseInt(days)} days')
  `);

  // Per provider
  const providerResult = db.exec(`
    SELECT
      p.name, p.slug,
      COALESCE(SUM(u.input_tokens), 0) as input_tokens,
      COALESCE(SUM(u.output_tokens), 0) as output_tokens,
      COALESCE(SUM(u.total_tokens), 0) as total_tokens,
      COALESCE(SUM(u.cost), 0) as cost,
      COUNT(u.id) as requests
    FROM providers p
    LEFT JOIN usage_logs u ON p.id = u.provider_id AND u.created_at >= datetime('now', '-${parseInt(days)} days')
    GROUP BY p.id
    ORDER BY cost DESC
  `);

  // Daily trend
  const dailyResult = db.exec(`
    SELECT
      DATE(created_at) as date,
      COALESCE(SUM(total_tokens), 0) as tokens,
      COALESCE(SUM(cost), 0) as cost,
      COUNT(*) as requests
    FROM usage_logs
    WHERE created_at >= datetime('now', '-${parseInt(days)} days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `);

  // Top models
  const modelResult = db.exec(`
    SELECT
      model,
      COALESCE(SUM(total_tokens), 0) as tokens,
      COALESCE(SUM(cost), 0) as cost,
      COUNT(*) as requests
    FROM usage_logs
    WHERE created_at >= datetime('now', '-${parseInt(days)} days')
    GROUP BY model
    ORDER BY cost DESC
    LIMIT 10
  `);

  const mapResult = (r) => {
    if (r.length === 0) return [];
    const cols = r[0].columns;
    return r[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
  };

  const total = mapResult(totalResult)[0] || { total_input: 0, total_output: 0, total_tokens: 0, total_cost: 0, total_requests: 0 };

  res.json({
    total,
    byProvider: mapResult(providerResult),
    dailyTrend: mapResult(dailyResult),
    topModels: mapResult(modelResult),
  });
});

app.get('/api/usage/logs', authMiddleware, (req, res) => {
  const db = getDb();
  const { page = 1, limit = 50, provider, model, days = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = `WHERE u.created_at >= datetime('now', '-${parseInt(days)} days')`;
  const params = [];
  if (provider) {
    where += " AND p.slug = ?";
    params.push(provider);
  }
  if (model) {
    where += " AND u.model LIKE ?";
    params.push(`%${model}%`);
  }

  const countResult = db.exec(`SELECT COUNT(*) as count FROM usage_logs u JOIN providers p ON u.provider_id = p.id ${where}`, params);
  const totalCount = countResult.length > 0 ? countResult[0].values[0][0] : 0;

  const result = db.exec(`
    SELECT u.*, p.name as provider_name, p.slug as provider_slug
    FROM usage_logs u
    JOIN providers p ON u.provider_id = p.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ${parseInt(limit)} OFFSET ${offset}
  `, params);

  const mapResult = (r) => {
    if (r.length === 0) return [];
    const cols = r[0].columns;
    return r[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
  };

  res.json({
    logs: mapResult(result),
    total: totalCount,
    page: parseInt(page),
    totalPages: Math.ceil(totalCount / parseInt(limit)),
  });
});

// ===== MODEL PRICING =====
app.get('/api/pricing', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.exec("SELECT * FROM model_pricing ORDER BY provider_slug, model");
  if (result.length === 0) return res.json([]);
  const cols = result[0].columns;
  res.json(result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  }));
});

app.put('/api/pricing/:id', authMiddleware, adminOnly, (req, res) => {
  const { input_price_per_1k, output_price_per_1k } = req.body;
  const db = getDb();
  db.run("UPDATE model_pricing SET input_price_per_1k = ?, output_price_per_1k = ?, updated_at = datetime('now') WHERE id = ?",
    [input_price_per_1k, output_price_per_1k, req.params.id]);
  saveDatabase();
  res.json({ message: 'Pricing updated' });
});

// ===== BUDGET ALERTS =====
app.get('/api/alerts', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.exec(`
    SELECT a.*, p.name as provider_name
    FROM budget_alerts a
    LEFT JOIN providers p ON a.provider_id = p.id
    ORDER BY a.id
  `);
  if (result.length === 0) return res.json([]);
  const cols = result[0].columns;
  res.json(result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  }));
});

app.post('/api/alerts', authMiddleware, adminOnly, (req, res) => {
  const { provider_id, threshold_percent, is_global } = req.body;
  const db = getDb();
  db.run("INSERT INTO budget_alerts (provider_id, threshold_percent, is_global) VALUES (?, ?, ?)",
    [provider_id || null, threshold_percent, is_global ? 1 : 0]);
  saveDatabase();
  res.json({ message: 'Alert created' });
});

app.delete('/api/alerts/:id', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  db.run("DELETE FROM budget_alerts WHERE id = ?", [req.params.id]);
  saveDatabase();
  res.json({ message: 'Alert deleted' });
});

// ===== DEMO DATA SEEDER =====
app.post('/api/demo/seed', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  const providers = db.exec("SELECT id, slug FROM providers");
  if (providers.length === 0) return res.status(400).json({ error: 'No providers found' });

  const providerMap = {};
  providers[0].values.forEach(([id, slug]) => { providerMap[slug] = id; });

  const models = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1-mini'],
    anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  };

  const users = ['team-alpha', 'team-beta', 'research', 'product', 'engineering'];

  // Generate 30 days of data
  for (let day = 29; day >= 0; day--) {
    const numRequests = Math.floor(Math.random() * 30) + 10;
    for (let i = 0; i < numRequests; i++) {
      const providerSlugs = Object.keys(models);
      const slug = providerSlugs[Math.floor(Math.random() * providerSlugs.length)];
      const providerId = providerMap[slug];
      if (!providerId) continue;

      const modelList = models[slug];
      const model = modelList[Math.floor(Math.random() * modelList.length)];
      const inputTokens = Math.floor(Math.random() * 3000) + 100;
      const outputTokens = Math.floor(Math.random() * 2000) + 50;
      const userLabel = users[Math.floor(Math.random() * users.length)];
      const responseTime = Math.floor(Math.random() * 5000) + 200;

      // Get cost
      const pricingResult = db.exec(
        "SELECT input_price_per_1k, output_price_per_1k FROM model_pricing WHERE provider_slug = ? AND model = ?",
        [slug, model]
      );
      let cost = 0;
      if (pricingResult.length > 0 && pricingResult[0].values.length > 0) {
        const [ip, op] = pricingResult[0].values[0];
        cost = (inputTokens / 1000) * ip + (outputTokens / 1000) * op;
      }

      db.run(`
        INSERT INTO usage_logs (provider_id, model, input_tokens, output_tokens, total_tokens, cost, endpoint, user_label, status_code, response_time_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${day} days', '+${Math.floor(Math.random() * 86400)} seconds'))
      `, [providerId, model, inputTokens, outputTokens, inputTokens + outputTokens, cost, '/v1/chat/completions', userLabel, 200, responseTime]);
    }
  }

  saveDatabase();
  res.json({ message: 'Demo data seeded successfully' });
});

// ===== PROXY ROUTES =====
app.all('/api/proxy/openai/*', authMiddleware, proxyOpenAI);
app.all('/api/proxy/anthropic/*', authMiddleware, proxyAnthropic);
app.all('/api/proxy/gemini/*', authMiddleware, proxyGemini);

// SPA fallback
const fs = require('fs');
const distIndex = path.join(__dirname, '..', 'client', 'dist', 'index.html');
app.get('*', (req, res) => {
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`GenAI Token Monitor server running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}`);
  });
});
