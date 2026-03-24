const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'monitor.db');
let db;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      api_key_encrypted TEXT,
      base_url TEXT,
      is_active INTEGER DEFAULT 1,
      monthly_budget REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      endpoint TEXT,
      user_label TEXT,
      request_id TEXT,
      status_code INTEGER,
      response_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS budget_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER,
      threshold_percent REAL NOT NULL,
      is_global INTEGER DEFAULT 0,
      is_triggered INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS model_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_slug TEXT NOT NULL,
      model TEXT NOT NULL,
      input_price_per_1k REAL DEFAULT 0,
      output_price_per_1k REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider_slug, model)
    )
  `);

  // Seed default data
  seedDefaults();
  saveDatabase();

  return db;
}

function seedDefaults() {
  // Check if admin exists
  const admin = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (admin.length === 0) {
    const hash = bcrypt.hashSync('Admin123!', 10);
    db.run("INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)",
      ['admin', hash, 'Administrator', 'admin']);
  }

  // Seed providers
  const providers = db.exec("SELECT id FROM providers");
  if (providers.length === 0) {
    const defaultProviders = [
      { name: 'OpenAI', slug: 'openai', base_url: 'https://api.openai.com' },
      { name: 'Anthropic', slug: 'anthropic', base_url: 'https://api.anthropic.com' },
      { name: 'Google Gemini', slug: 'gemini', base_url: 'https://generativelanguage.googleapis.com' },
      { name: 'Azure OpenAI', slug: 'azure-openai', base_url: '' },
      { name: 'AWS Bedrock', slug: 'aws-bedrock', base_url: '' },
    ];
    for (const p of defaultProviders) {
      db.run("INSERT INTO providers (name, slug, base_url) VALUES (?, ?, ?)",
        [p.name, p.slug, p.base_url]);
    }
  }

  // Seed model pricing (per 1K tokens)
  const pricing = db.exec("SELECT id FROM model_pricing");
  if (pricing.length === 0) {
    const models = [
      // OpenAI
      { provider: 'openai', model: 'gpt-4o', input: 0.0025, output: 0.01 },
      { provider: 'openai', model: 'gpt-4o-mini', input: 0.00015, output: 0.0006 },
      { provider: 'openai', model: 'gpt-4-turbo', input: 0.01, output: 0.03 },
      { provider: 'openai', model: 'gpt-4', input: 0.03, output: 0.06 },
      { provider: 'openai', model: 'gpt-3.5-turbo', input: 0.0005, output: 0.0015 },
      { provider: 'openai', model: 'o1', input: 0.015, output: 0.06 },
      { provider: 'openai', model: 'o1-mini', input: 0.003, output: 0.012 },
      // Anthropic
      { provider: 'anthropic', model: 'claude-opus-4-6', input: 0.015, output: 0.075 },
      { provider: 'anthropic', model: 'claude-sonnet-4-6', input: 0.003, output: 0.015 },
      { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', input: 0.0008, output: 0.004 },
      { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', input: 0.003, output: 0.015 },
      { provider: 'anthropic', model: 'claude-3-haiku-20240307', input: 0.00025, output: 0.00125 },
      // Gemini
      { provider: 'gemini', model: 'gemini-2.0-flash', input: 0.0001, output: 0.0004 },
      { provider: 'gemini', model: 'gemini-1.5-pro', input: 0.00125, output: 0.005 },
      { provider: 'gemini', model: 'gemini-1.5-flash', input: 0.000075, output: 0.0003 },
    ];
    for (const m of models) {
      db.run("INSERT INTO model_pricing (provider_slug, model, input_price_per_1k, output_price_per_1k) VALUES (?, ?, ?, ?)",
        [m.provider, m.model, m.input, m.output]);
    }
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb, saveDatabase };
