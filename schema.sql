-- Compatible with hosted Postgres (Neon, Supabase, Vercel Postgres).
-- Tables are also auto-created at runtime via ensureTables() in src/lib/db.ts.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  firebase_uid TEXT
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_unique
ON users(firebase_uid)
WHERE firebase_uid IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_firebase_uid_key'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_firebase_uid_key UNIQUE (firebase_uid);
  END IF;
END
$$;

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
