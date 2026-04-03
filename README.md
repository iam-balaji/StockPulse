# Stock Tracker MVP

Next.js full-stack app with JWT auth, PostgreSQL, stock search/subscriptions, quote + chart + top 3 news via Finnhub.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create env:

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
