-- Compatible with hosted Postgres (Neon, Supabase, Vercel Postgres).
-- Tables are also auto-created at runtime via ensureTables() in src/lib/db.ts.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stocks (
  id SERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  UNIQUE (user_id, stock_id)
);

CREATE SEQUENCE IF NOT EXISTS search_events_id_seq;

CREATE TABLE IF NOT EXISTS search_events (
  id INTEGER PRIMARY KEY DEFAULT nextval('search_events_id_seq'),
  symbol TEXT NOT NULL,
  searched_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER SEQUENCE search_events_id_seq OWNED BY search_events.id;
