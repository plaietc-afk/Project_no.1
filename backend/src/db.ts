import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../data.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ---- Initialize tables ----
db.exec(`
  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    token_quota INTEGER DEFAULT 0,
    usd_budget REAL DEFAULT 0,
    rpm_limit INTEGER DEFAULT 10,
    allowed_models TEXT DEFAULT '[]',
    reset_period TEXT DEFAULT 'monthly',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    package_id INTEGER DEFAULT 3,
    tokens_used INTEGER DEFAULT 0,
    usd_spent REAL DEFAULT 0,
    usage_reset_at DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(package_id) REFERENCES packages(id)
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai',
    budget REAL DEFAULT 0,
    project_id TEXT,
    webhook_url TEXT,
    alert_thresholds TEXT DEFAULT '[80,95]',
    last_alert_percentage INTEGER DEFAULT 0,
    rpm_limit INTEGER DEFAULT 0,
    tpm_limit INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    key_hash TEXT,
    router_config TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS token_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,
    user_id INTEGER,
    model TEXT,
    provider TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    is_cached INTEGER DEFAULT 0,
    cost_usd_saved REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(api_key_id) REFERENCES api_keys(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS request_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    req_hash TEXT UNIQUE NOT NULL,
    response_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );
`);

// ---- Migrations (idempotent) ----
const migrations: string[] = [
  "ALTER TABLE api_keys ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai';",
  "ALTER TABLE api_keys ADD COLUMN budget REAL DEFAULT 0;",
  "ALTER TABLE api_keys ADD COLUMN project_id TEXT;",
  "ALTER TABLE api_keys ADD COLUMN webhook_url TEXT;",
  "ALTER TABLE api_keys ADD COLUMN alert_thresholds TEXT DEFAULT '[80,95]';",
  "ALTER TABLE api_keys ADD COLUMN last_alert_percentage INTEGER DEFAULT 0;",
  "ALTER TABLE api_keys ADD COLUMN rpm_limit INTEGER DEFAULT 0;",
  "ALTER TABLE api_keys ADD COLUMN tpm_limit INTEGER DEFAULT 0;",
  "ALTER TABLE api_keys ADD COLUMN is_active INTEGER DEFAULT 1;",
  "ALTER TABLE api_keys ADD COLUMN key_hash TEXT;",
  "ALTER TABLE api_keys ADD COLUMN router_config TEXT;",
  "ALTER TABLE api_keys ADD COLUMN user_id INTEGER;",
  "ALTER TABLE token_logs ADD COLUMN cost_usd REAL DEFAULT 0;",
  "ALTER TABLE token_logs ADD COLUMN is_cached INTEGER DEFAULT 0;",
  "ALTER TABLE token_logs ADD COLUMN cost_usd_saved REAL DEFAULT 0;",
  "ALTER TABLE token_logs ADD COLUMN provider TEXT;",
  "ALTER TABLE token_logs ADD COLUMN user_id INTEGER;",
  "ALTER TABLE token_logs ADD COLUMN latency_ms INTEGER DEFAULT 0;",
  "ALTER TABLE users ADD COLUMN display_name TEXT;"
];
for (const m of migrations) { try { db.exec(m); } catch (_) { /* already applied */ } }

// ---- Seed default packages ----
const packageCount = (db.prepare('SELECT COUNT(*) as c FROM packages').get() as { c: number }).c;
if (packageCount === 0) {
  const freeModels = JSON.stringify(['gpt-3.5-turbo', 'gemini-1.5-flash-latest', 'llama3-8b-8192']);
  db.prepare(`INSERT INTO packages (name, display_name, token_quota, usd_budget, rpm_limit, allowed_models, reset_period)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run('free', 'Free', 100_000, 2.0, 10, freeModels, 'monthly');
  db.prepare(`INSERT INTO packages (name, display_name, token_quota, usd_budget, rpm_limit, allowed_models, reset_period)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run('pro', 'Pro', 5_000_000, 50.0, 100, '[]', 'monthly');
  db.prepare(`INSERT INTO packages (name, display_name, token_quota, usd_budget, rpm_limit, allowed_models, reset_period)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run('enterprise', 'Enterprise', 0, 0, 1000, '[]', 'monthly');
}

// ---- Seed default user (display name only — no auth) ----
const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
if (userCount === 0) {
  db.prepare(`INSERT INTO users (email, password_hash, display_name, full_name, role, package_id) VALUES (?, '', 'Admin', 'Admin', 'admin', 3)`)
    .run('admin@localhost');
}

export default db;
