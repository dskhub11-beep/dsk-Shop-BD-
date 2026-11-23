import dns from 'dns';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Pool, PoolClient, PoolConfig } from 'pg';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore on runtimes where setDefaultResultOrder is unavailable
}

export type DbDialect = 'postgres' | 'sqlite';

export interface ExecuteResult {
  lastInsertRowid: number;
  changes: number;
}

export interface DbRunner {
  dialect: DbDialect;
  queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
  insert(sql: string, params?: unknown[]): Promise<number>;
  execRaw(sql: string): Promise<void>;
}

function getPostgresConnectionString(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.SUPABASE_DB_URL,
    process.env.SUPABASE_DATABASE_URL,
  ];
  for (const val of candidates) {
    if (val && val.trim().length > 0) {
      const cleaned = val.trim().replace(/^["']|["']$/g, '').trim();
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }
  return null;
}

function buildPgPoolConfig(rawUrl: string, isServerless: boolean): { config: PoolConfig; hostname: string } {
  let connectionString = rawUrl;
  let hostname = '';
  let ssl: PoolConfig['ssl'];

  try {
    const parsed = new URL(rawUrl);
    hostname = parsed.hostname || '';
    const isLocalhost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const sslMode = (parsed.searchParams.get('sslmode') || '').toLowerCase();

    if (sslMode === 'disable') {
      ssl = false;
    } else if (isLocalhost) {
      ssl = undefined;
    } else if (sslMode === 'verify-full') {
      ssl = undefined; // Let pg use full verification from URL
    } else {
      // Strip 'prefer'/'require'/'verify-ca' so pg v8 does not treat them as verify-full or emit warnings,
      // and apply rejectUnauthorized: false for managed Postgres / Supabase poolers.
      if (parsed.searchParams.has('sslmode')) {
        parsed.searchParams.delete('sslmode');
        connectionString = parsed.toString();
      }
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    const isLocalhost = rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1');
    ssl = isLocalhost ? undefined : { rejectUnauthorized: false };
  }

  return {
    hostname,
    config: {
      connectionString,
      ssl,
      max: isServerless ? 5 : 10,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: isServerless ? 8000 : 4500,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    },
  };
}

function convertPlaceholdersToPg(sql: string): string {
  let out = '';
  let index = 1;
  let inSingleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      if (inSingleQuote && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      out += ch;
    } else if (ch === '?' && !inSingleQuote) {
      out += `$${index++}`;
    } else {
      out += ch;
    }
  }
  return out;
}

let pgPool: Pool | null = null;
let sqliteDb: any = null;
let activeDialect: DbDialect | null = null;
let storageLocationInfo = '';
let fallbackWarning: string | undefined;
let backendInitPromise: Promise<DbDialect> | null = null;

async function initBackend(): Promise<DbDialect> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const isProduction = process.env.NODE_ENV === 'production';
  const pgUrl = getPostgresConnectionString();
  fallbackWarning = undefined;

  if (pgUrl) {
    const { config, hostname } = buildPgPoolConfig(pgUrl, isServerless);
    const pool = new Pool(config);
    pool.on('error', (err) => {
      console.error('PostgreSQL pool idle client error:', err?.message || err);
    });

    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
      pgPool = pool;
      activeDialect = 'postgres';
      storageLocationInfo = 'PostgreSQL / Supabase';
      return activeDialect;
    } catch (err: any) {
      await pool.end().catch(() => {});
      const msg = String(err?.message || '');
      const isTimeoutOrUnreachable = /timeout|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED/i.test(msg);
      let detailedError = err;

      if (isTimeoutOrUnreachable && hostname) {
        const isSupabaseDirect = /^db\.[a-z0-9-]+\.supabase\.co$/i.test(hostname);
        if (isSupabaseDirect) {
          detailedError = new Error(
            `${msg} (Supabase direct host uses IPv6; please use the Supabase IPv4 Session/Transaction Pooler URL ending in .pooler.supabase.com)`
          );
        } else {
          const addrs = await dns.promises.lookup(hostname, { all: true }).catch(() => []);
          if (addrs.length > 0 && addrs.every((a) => a.family === 6)) {
            detailedError = new Error(
              `${msg} (Database host resolved only to IPv6, which is unreachable from this IPv4 runtime; please use an IPv4 pooler connection string)`
            );
          }
        }
      }

      // In local development preview (non-Vercel, non-production), fall back to local SQLite
      // if remote PostgreSQL is unreachable from this sandbox, while exposing the warning in /api/health.
      if (!isServerless && !isProduction) {
        fallbackWarning = detailedError?.message || msg || 'PostgreSQL connection failed';
        console.warn(
          `Remote PostgreSQL unreachable in dev preview (${fallbackWarning}); using local SQLite store.`
        );
      } else {
        throw detailedError;
      }
    }
  }

  // SQLite backend (local ./data/store.db or /tmp/dsk-shop-data/store.db on read-only serverless)
  const { default: Database } = await import('better-sqlite3');
  const bundledDbPath = path.resolve(process.cwd(), 'data', 'store.db');

  let targetDbPath = bundledDbPath;
  if (isServerless) {
    const tmpDir = path.join(os.tmpdir(), 'dsk-shop-data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    targetDbPath = path.join(tmpDir, 'store.db');
    if (!fs.existsSync(targetDbPath) && fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, targetDbPath);
    }
  } else {
    const dataDir = path.dirname(bundledDbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  sqliteDb = new Database(targetDbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  activeDialect = 'sqlite';
  storageLocationInfo = isServerless
    ? 'SQLite (/tmp ephemeral)'
    : fallbackWarning
      ? 'SQLite (local fallback)'
      : 'SQLite (local)';
  return activeDialect;
}

async function ensureBackend(): Promise<DbDialect> {
  if (activeDialect) return activeDialect;
  if (!backendInitPromise) {
    backendInitPromise = initBackend().catch((err) => {
      backendInitPromise = null;
      throw err;
    });
  }
  return backendInitPromise;
}

function createPgRunner(client: Pool | PoolClient): DbRunner {
  return {
    dialect: 'postgres',
    async queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const pgSql = convertPlaceholdersToPg(sql);
      const res = await client.query(pgSql, params);
      return res.rows as T[];
    },
    async queryOne<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = []
    ): Promise<T | undefined> {
      const pgSql = convertPlaceholdersToPg(sql);
      const res = await client.query(pgSql, params);
      return res.rows[0] as T | undefined;
    },
    async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
      const pgSql = convertPlaceholdersToPg(sql);
      const res = await client.query(pgSql, params);
      return {
        lastInsertRowid: 0,
        changes: res.rowCount ?? 0,
      };
    },
    async insert(sql: string, params: unknown[] = []): Promise<number> {
      const trimmed = sql.trim().replace(/;$/, '');
      const hasReturning = /\bRETURNING\b/i.test(trimmed);
      const pgSql = convertPlaceholdersToPg(hasReturning ? trimmed : `${trimmed} RETURNING id`);
      const res = await client.query(pgSql, params);
      return Number(res.rows[0]?.id ?? 0);
    },
    async execRaw(sql: string): Promise<void> {
      await client.query(sql);
    },
  };
}

function createSqliteRunner(dbInstance: any): DbRunner {
  return {
    dialect: 'sqlite',
    async queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      return dbInstance.prepare(sql).all(...params) as T[];
    },
    async queryOne<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = []
    ): Promise<T | undefined> {
      return dbInstance.prepare(sql).get(...params) as T | undefined;
    },
    async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
      const info = dbInstance.prepare(sql).run(...params);
      return {
        lastInsertRowid: Number(info.lastInsertRowid ?? 0),
        changes: Number(info.changes ?? 0),
      };
    },
    async insert(sql: string, params: unknown[] = []): Promise<number> {
      const info = dbInstance.prepare(sql).run(...params);
      return Number(info.lastInsertRowid ?? 0);
    },
    async execRaw(sql: string): Promise<void> {
      dbInstance.exec(sql);
    },
  };
}

export async function getDb(): Promise<DbRunner> {
  const dialect = await ensureBackend();
  if (dialect === 'postgres' && pgPool) {
    return createPgRunner(pgPool);
  }
  return createSqliteRunner(sqliteDb);
}

export async function runInTransaction<T>(fn: (tx: DbRunner) => Promise<T>): Promise<T> {
  const dialect = await ensureBackend();
  if (dialect === 'postgres' && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const runner = createPgRunner(client);
      const result = await fn(runner);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // SQLite transaction (handles async callbacks safely via BEGIN/COMMIT/ROLLBACK)
  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const runner = createSqliteRunner(sqliteDb);
    const result = await fn(runner);
    sqliteDb.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      sqliteDb.exec('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }
}

export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  engine: string;
  persistent: boolean;
  warning?: string;
  error?: string;
}> {
  try {
    const db = await getDb();
    await db.queryOne('SELECT 1 AS ok');
    return {
      ok: true,
      engine: storageLocationInfo,
      persistent:
        db.dialect === 'postgres' ||
        !(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
      ...(fallbackWarning ? { warning: fallbackWarning } : {}),
    };
  } catch (error: any) {
    return {
      ok: false,
      engine: getPostgresConnectionString() ? 'PostgreSQL / Supabase' : 'SQLite',
      persistent: false,
      error: error?.message || 'Database connection failed',
    };
  }
}
