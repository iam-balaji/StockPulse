import { Pool } from "pg";

let pool: Pool | null = null;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const needsSsl =
    connectionString.includes("sslmode=require") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com") ||
    process.env.POSTGRES_SSL === "true";

  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {})
  });
}

/** Lazy pool so `next build` and imports work when DATABASE_URL is only set at runtime (e.g. Vercel). */
export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function ensureTables() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS stocks (
      id SERIAL PRIMARY KEY,
      symbol TEXT UNIQUE NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      UNIQUE (user_id, stock_id)
    );
  `);

  await db.query(`
    CREATE SEQUENCE IF NOT EXISTS search_events_id_seq;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS search_events (
      id INTEGER PRIMARY KEY DEFAULT nextval('search_events_id_seq'),
      symbol TEXT NOT NULL,
      searched_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER SEQUENCE search_events_id_seq OWNED BY search_events.id;
  `);
}
