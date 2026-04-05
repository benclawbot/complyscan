import fs from 'fs';
import path from 'path';

type MaybePromise<T> = T | Promise<T>;

type StatementLike = {
  bind: (...params: any[]) => {
    get: () => MaybePromise<any>;
    all: () => MaybePromise<any[]>;
    run: () => MaybePromise<any>;
  };
  get: (...params: any[]) => MaybePromise<any>;
  all: (...params: any[]) => MaybePromise<any[]>;
  run: (...params: any[]) => MaybePromise<any>;
};

export type DbClient = {
  prepare(sql: string): StatementLike;
  exec(sql: string): MaybePromise<void>;
};

const DB_PATH = process.env.DATABASE_PATH || (process.env.CF_PAGES ? '/tmp/complyscan.db' : './data/complyscan.db');

let localDb: any;

function getCloudflareContextEnv(): any {
  const context = (globalThis as any)[Symbol.for('__cloudflare-context__')];
  return context?.env;
}

export function getRuntimeEnv(env?: any): any {
  return env ?? (globalThis as any).__env ?? getCloudflareContextEnv() ?? undefined;
}

function ensureLocalColumn(db: any, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function initializeLocalSchema(db: any) {
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
      plan TEXT NOT NULL DEFAULT 'agency',
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

    CREATE TABLE IF NOT EXISTS report_purchases (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      stripe_payment_intent TEXT,
      purchased_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
    CREATE INDEX IF NOT EXISTS idx_scans_email ON scans(email);
    CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at);
    CREATE INDEX IF NOT EXISTS idx_scans_subscriber_id ON scans(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_subscribers_stripe_customer ON subscribers(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_agency_clients_subscriber ON agency_clients(agency_subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_report_purchases_scan_id ON report_purchases(scan_id);
  `);

  ensureLocalColumn(db, 'subscribers', 'current_period_end', 'current_period_end TEXT');
  ensureLocalColumn(db, 'subscribers', 'cancel_at_period_end', 'cancel_at_period_end INTEGER NOT NULL DEFAULT 0');
  ensureLocalColumn(db, 'subscribers', 'updated_at', `updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`);
  ensureLocalColumn(db, 'subscriber_tokens', 'expires_at', 'expires_at TEXT');
  ensureLocalColumn(db, 'subscriber_tokens', 'last_used_at', 'last_used_at TEXT');
  ensureLocalColumn(db, 'scans', 'subscriber_id', 'subscriber_id TEXT');
  ensureLocalColumn(db, 'scans', 'user_id', 'user_id TEXT');
}

function createLocalSqliteClient(): DbClient {
  if (!localDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
     
    const Database = require('better-sqlite3');
    localDb = new Database(DB_PATH);
    localDb.pragma('journal_mode = DELETE');
    localDb.pragma('busy_timeout = 10000');
    localDb.pragma('synchronous = FULL');
    initializeLocalSchema(localDb);
  }

  return {
    prepare(sql: string): StatementLike {
      const stmt = localDb.prepare(sql);
      return {
        bind: (...params: any[]) => ({
          get: () => stmt.get(...params),
          all: () => stmt.all(...params),
          run: () => stmt.run(...params),
        }),
        get: (...params: any[]) => stmt.get(...params),
        all: (...params: any[]) => stmt.all(...params),
        run: (...params: any[]) => stmt.run(...params),
      };
    },
    exec(sql: string) {
      localDb.exec(sql);
    },
  };
}

function createD1Client(db: D1Database): DbClient {
  return {
    prepare(sql: string): StatementLike {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: any[]) => {
          const bound = stmt.bind(...params);
          return {
            get: async () => bound.first(),
            all: async () => (await bound.all()).results,
            run: async () => bound.run(),
          };
        },
        get: async (...params: any[]) => {
          const bound = params.length ? stmt.bind(...params) : stmt;
          return bound.first();
        },
        all: async (...params: any[]) => {
          const bound = params.length ? stmt.bind(...params) : stmt;
          return (await bound.all()).results;
        },
        run: async (...params: any[]) => {
          const bound = params.length ? stmt.bind(...params) : stmt;
          return bound.run();
        },
      };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  };
}

export function getDb(env?: any): DbClient {
  const runtimeEnv = getRuntimeEnv(env);

  if (runtimeEnv?.DB) {
    return createD1Client(runtimeEnv.DB as D1Database);
  }

  if (typeof process !== 'undefined') {
    return createLocalSqliteClient();
  }

  throw new Error('No database binding available. Provide env.DB in Cloudflare or use local Node runtime.');
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export async function compressGzip(text: string): Promise<string> {
  if (typeof CompressionStream !== 'undefined') {
    const encoded = new TextEncoder().encode(text);
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    await writer.write(encoded);
    await writer.close();
    const response = new Response(cs.readable);
    return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
  }

  const zlib = await import('zlib');
  return zlib.gzipSync(Buffer.from(text, 'utf8')).toString('base64');
}

export async function decompressGzip(b64: string): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    await writer.write(base64ToBytes(b64) as BufferSource);
    await writer.close();
    const response = new Response(ds.readable);
    return Buffer.from(await response.arrayBuffer()).toString('utf8');
  }

  const zlib = await import('zlib');
  return zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
}

export async function parseResultJson(rawJson: string): Promise<any | null> {
  if (!rawJson) return null;

  try {
    const withoutHash = rawJson.includes('|||HASH:') ? rawJson.split('|||HASH:')[0] : rawJson;
    const bytes = Buffer.from(withoutHash, 'base64');
    const isMaybeBase64 = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (isMaybeBase64) {
      return JSON.parse(await decompressGzip(withoutHash));
    }
    return JSON.parse(withoutHash);
  } catch {
    try {
      return JSON.parse(rawJson);
    } catch {
      return null;
    }
  }
}

export async function storeReport(scanId: string, pdfData: ArrayBuffer, env?: any): Promise<string | null> {
  const runtimeEnv = getRuntimeEnv(env);
  if (!runtimeEnv?.REPORTS_BUCKET) return null;
  const key = `reports/${scanId}.pdf`;
  await runtimeEnv.REPORTS_BUCKET.put(key, pdfData, {
    httpMetadata: { contentType: 'application/pdf' },
    customMetadata: { scanId, storedAt: new Date().toISOString() },
  });
  return key;
}

export async function getSignedReportUrl(scanId: string, env?: any): Promise<string | null> {
  const runtimeEnv = getRuntimeEnv(env);
  if (!runtimeEnv?.REPORTS_BUCKET) return null;
  const key = `reports/${scanId}.pdf`;
  return runtimeEnv.REPORTS_BUCKET.createSignedUrl({ pathname: key, expires: 3600 });
}

export async function sendScanJob(job: { scanId: string; url: string; email?: string; trigger: string }, env?: any): Promise<void> {
  const runtimeEnv = getRuntimeEnv(env);
  if (!runtimeEnv?.SCAN_QUEUE) return;
  await runtimeEnv.SCAN_QUEUE.send(job);
}
