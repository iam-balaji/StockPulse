# Stock Tracker MVP

Next.js full-stack app with JWT auth, PostgreSQL, stock search/subscriptions, quote + chart + top 3 news via Finnhub.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create env (copy the example, then edit `.env.local` with your real `DATABASE_URL`, `JWT_SECRET`, and `FINNHUB_API_KEY`). Do not commit `.env.local`.

```bash
cp .env.example .env.local
```

3. Create PostgreSQL database and tables:

```bash
createdb stocks_mvp
psql postgresql://postgres:postgres@localhost:5432/stocks_mvp -f schema.sql
```

4. Start app:

```bash
npm run dev
```

App URL: `http://localhost:3000`

## Deploy to Vercel

This repo is a Next.js app; the Git root should be this project folder (where `package.json` lives).

### 1. Push to GitHub

Ensure the latest code is on your default branch (e.g. `main`).

### 2. Create a hosted PostgreSQL database

Vercel’s serverless functions work best with a **managed Postgres** that supports **SSL** and pooling, for example:

- [Neon](https://neon.tech) (free tier)
- [Supabase](https://supabase.com) (Postgres)
- [Vercel Postgres](https://vercel.com/storage/postgres) (if available on your plan)

Create a database and copy the **connection string** (often includes `sslmode=require`).

### 3. Apply the schema

Run the SQL in `schema.sql` against that database (provider’s **SQL editor** or `psql` with the hosted URL).

Tables are also auto-created on first API use via `ensureTables()`, but running `schema.sql` once is a clean baseline.

### 4. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. **Import** your GitHub repository.
3. **Framework Preset:** Next.js (auto-detected).
4. **Root Directory:** leave default (repository root = this app). If your repo wraps this app in a subfolder, set **Root Directory** to that folder (e.g. `web`).
5. **Build Command:** `npm run build` (default).
6. **Output:** default for Next.js.

### 5. Environment variables (Production)

In **Project → Settings → Environment Variables**, add for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Your hosted Postgres URL (from Neon/Supabase/etc.) |
| `JWT_SECRET` | Long random string (e.g. 32+ chars); do not reuse a public example |
| `FINNHUB_API_KEY` | From [finnhub.io](https://finnhub.io) |

Redeploy after saving env vars (**Deployments → … → Redeploy**).

### 6. First deploy

Click **Deploy**. When it finishes, open the **Production URL** and test signup/login.

**Note:** Local-only Postgres (`localhost`) will not work on Vercel; you must use a **public** `DATABASE_URL` reachable from the internet.
