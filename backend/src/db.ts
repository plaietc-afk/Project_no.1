import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../data.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS token_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,
    model TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    is_cached INTEGER DEFAULT 0,
    cost_usd_saved REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(api_key_id) REFERENCES api_keys(id)
  );

  CREATE TABLE IF NOT EXISTS request_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    req_hash TEXT UNIQUE NOT NULL,
    response_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );
`);

// --- MIGRATIONS ---
try { db.exec("ALTER TABLE api_keys ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai';"); } catch (e) { }
try { db.exec("ALTER TABLE api_keys ADD COLUMN budget REAL DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE api_keys ADD COLUMN project_id TEXT;"); } catch (e) { }
try { db.exec("ALTER TABLE api_keys ADD COLUMN webhook_url TEXT;"); } catch (e) { }
try { db.exec("ALTER TABLE api_keys ADD COLUMN alert_thresholds TEXT DEFAULT '[80,95]';"); } catch (e) { }
try { db.exec("ALTER TABLE api_keys ADD COLUMN last_alert_percentage INTEGER DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE api_keys ADD COLUMN rpm_limit INTEGER DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE api_keys ADD COLUMN tpm_limit INTEGER DEFAULT 0;"); } catch (e) { }

try { db.exec("ALTER TABLE token_logs ADD COLUMN cost_usd REAL DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE token_logs ADD COLUMN is_cached INTEGER DEFAULT 0;"); } catch (e) { }
try { db.exec("ALTER TABLE token_logs ADD COLUMN cost_usd_saved REAL DEFAULT 0;"); } catch (e) { }

export default db;
