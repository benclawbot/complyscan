// DEPRECATED — This module is no longer used.
// All database access goes through lib/env.ts (Cloudflare D1 or Vercel Postgres).
// Keeping this file for reference only.
// @deprecated
const DB_PATH = process.env.DATABASE_PATH || (process.env.CF_PAGES ? '/tmp/complyscan.db' : './data/complyscan.db');

 
let db: any;

 
function loadDb(): any {
   
  const Database = require('better-sqlite3');
  return new Database(DB_PATH);
}

export function getDb(): any {
  if (!db) {
    db = loadDb();
    // WAL causes issues on Lambda /tmp (multiple .db-wal and .db-shm files
    // getting out of sync between Lambda invocations). Use DELETE mode instead.
    db.pragma('journal_mode = DELETE');
    // Wait up to 10s for locks to clear before giving up
    db.pragma('busy_timeout = 10000');
    // FULL ensures writes are durable before reporting success
    db.pragma('synchronous = FULL');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      last_used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result_json TEXT,
      email TEXT,
      stripe_session_id TEXT,
      subscriber_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      stripe_customer_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS subscriber_tokens (
      token TEXT PRIMARY KEY,
      subscriber_id TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      last_used_at TEXT,
      FOREIGN KEY (subscriber_id) REFERENCES subscribers(id)
    );

    CREATE TABLE IF NOT EXISTS agency_clients (
      id TEXT PRIMARY KEY,
      agency_subscriber_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (agency_subscriber_id) REFERENCES subscribers(id)
    );
  `);
}

export interface Scan {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_json: string | null;
  email: string | null;
  stripe_session_id: string | null;
  created_at: string;
  completed_at: string | null;
}
