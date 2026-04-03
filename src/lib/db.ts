import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({ connectionString });

export async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stocks (
      id SERIAL PRIMARY KEY,
      symbol TEXT UNIQUE NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      UNIQUE (user_id, stock_id)
    );
  `);

  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS search_events_id_seq;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_events (
      id INTEGER PRIMARY KEY DEFAULT nextval('search_events_id_seq'),
      symbol TEXT NOT NULL,
      searched_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER SEQUENCE search_events_id_seq OWNED BY search_events.id;
  `);
}
