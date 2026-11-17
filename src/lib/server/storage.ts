import { readFileSync } from 'node:fs';
﻿import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import type { DatabaseSync } from 'node:sqlite';

const globals = globalThis as unknown as { pasabuyPool?: Pool; pasabuyQueue?: Promise<unknown>; pasabuyContext?: AsyncLocalStorage<PoolClient | "sqlite"> };
const context = globals.pasabuyContext ??= new AsyncLocalStorage<PoolClient | "sqlite">();
function pool() {
  const url = new URL(process.env.PASABUY_DATABASE_URL!);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  return globals.pasabuyPool ??= new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(process.env.PASABUY_DATABASE_CA_PATH ? { ca: readFileSync(process.env.PASABUY_DATABASE_CA_PATH, "utf8") } : {}) }, max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, statement_timeout: 15000 });
}
let sqliteProvider: () => DatabaseSync;
export function setSqliteProvider(provider: () => DatabaseSync) { sqliteProvider = provider; }
async function serial<T>(work: () => Promise<T>): Promise<T> {
  const previous = globals.pasabuyQueue || Promise.resolve();
  const next = previous.then(work, work); globals.pasabuyQueue = next.catch(() => {}); return next;
}
function sqlForPostgres(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`).replace(/\browid\b/gi, 'seq').replace(/\b(users|sessions|bookings|listings|conversations|notifications|attempts)\b/gi, 'pasabuy_app.$1');
}
async function rows(sql: string, values: unknown[]) {
  if (process.env.PASABUY_DATABASE_URL) {
    const client = context.getStore();
    const query = sqlForPostgres(sql);
    const result = await (client && client !== 'sqlite' ? client : pool()).query(query, values);
    return result.rows as Record<string, unknown>[];
  }
  const work = async () => {
    const statement = sqliteProvider().prepare(sql);
    if (/^\s*SELECT/i.test(sql)) return statement.all(...values as (string | number | null)[]);
    statement.run(...values as (string | number | null)[]); return [];
  };
  return context.getStore() === 'sqlite' ? work() : serial(work);
}
export const all = (sql: string, ...values: unknown[]) => rows(sql, values);
export const get = async (sql: string, ...values: unknown[]) => (await rows(sql, values))[0];
export const run = async (sql: string, ...values: unknown[]) => { await rows(sql, values); };
export async function transact<T>(work: () => Promise<T>): Promise<T> {
  if (context.getStore()) return work();
  if (!process.env.PASABUY_DATABASE_URL) return serial(async () => {
    const db = sqliteProvider(); db.exec('BEGIN IMMEDIATE');
    try { const result = await context.run('sqlite', work); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(17871501)');
    const result = await context.run(client, work);
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
