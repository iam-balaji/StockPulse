import { Pool } from "pg";

let pool: Pool | null = null;

/** Local Postgres usually has SSL off; `sslmode=require` in the URL still makes `pg` use TLS and breaks login with ECONNRESET / "server does not support SSL". */
function isLocalDatabaseHost(connectionString: string): boolean {
  try {
    const u = new URL(connectionString.replace(/^postgres(ql)?:/, "http:"));
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return /\blocalhost\b|127\.0\.0\.1/.test(connectionString);
  }
}

const EXAMPLE_DB_HOST = "host.region.provider.com";

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  try {
    const u = new URL(connectionString.replace(/^postgres(ql)?:/, "http:"));
    if (u.hostname.toLowerCase() === EXAMPLE_DB_HOST) {
      throw new Error(
        "DATABASE_URL still points at the placeholder host from .env.example. Set it to your real Postgres URL (Neon, Supabase, local, etc.)."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("DATABASE_URL still")) throw e;
  }

  const local = isLocalDatabaseHost(connectionString);
  const forceSslEnv = process.env.POSTGRES_SSL === "true";

  const needsSsl =
    (forceSslEnv || !local) &&
    (connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      connectionString.includes("supabase.co") ||
      connectionString.includes("pooler.supabase.com") ||
      forceSslEnv);

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
      email TEXT UNIQUE,
      password TEXT,
      firebase_uid TEXT
    );
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
  `);

  await db.query(`
    ALTER TABLE users
    ALTER COLUMN password DROP NOT NULL;
  `);

  try {
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_unique
      ON users(firebase_uid)
      WHERE firebase_uid IS NOT NULL;
    `);
  } catch (error: unknown) {
    // Concurrent app-start requests can race on index creation.
    const code = (error as { code?: string })?.code;
    const detail = (error as { detail?: string })?.detail || "";
    if (!(code === "23505" && detail.includes("users_firebase_uid_unique"))) {
      throw error;
    }
  }

  // Ensure ON CONFLICT can always target firebase_uid via a real UNIQUE constraint.
  await db.query(`
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
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS notify_daily BOOLEAN NOT NULL DEFAULT false;
  `);

  await db.query(`
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS last_digest_et_date DATE;
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

export async function ensureAppUser(firebaseUid: string, email: string | null): Promise<number> {
  const db = getPool();
  const normalizedEmail = email?.trim().toLowerCase() || `${firebaseUid}@firebase.local`;

  // First, link pre-existing email/password accounts to Firebase identity if compatible.
  const linked = await db.query(
    `
      UPDATE users
      SET firebase_uid = $1, password = COALESCE(password, '')
      WHERE email = $2
        AND (firebase_uid IS NULL OR firebase_uid = $1)
      RETURNING id
    `,
    [firebaseUid, normalizedEmail]
  );
  if (linked.rows[0]?.id) {
    return Number(linked.rows[0].id);
  }

  try {
    const result = await db.query(
      `
        INSERT INTO users (firebase_uid, email, password)
        VALUES ($1, $2, '')
        ON CONFLICT ON CONSTRAINT users_firebase_uid_key
        DO UPDATE SET email = EXCLUDED.email
        RETURNING id
      `,
      [firebaseUid, normalizedEmail]
    );
    return Number(result.rows[0].id);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    const constraint = (error as { constraint?: string })?.constraint;
    if (code === "23505" && constraint === "users_email_key") {
      throw new Error(
        "Email is already linked to another account. Use the same sign-in provider or unlink it first."
      );
    }
    throw error;
  }
}
