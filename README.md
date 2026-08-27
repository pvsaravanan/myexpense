# baaki

**Know where your money goes.** A personal finance and expense tracker — record income,
expenses, transfers and refunds; track budgets, savings and goals; and turn raw transactions
into answers like *"where did my money go this month?"*

Built with Next.js 15 (App Router) · TypeScript · Prisma · Supabase (Postgres) · Tailwind CSS.

## Quick start

```bash
npm install
cp .env.example .env   # then paste your Supabase connection strings (see below)
npm run setup          # generate Prisma client, push the schema to Postgres (empty)
npm run dev            # http://localhost:3000
```

### Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) and set a database password.
2. In the dashboard, open **Connect → ORM** (Prisma) and copy the two strings into `.env`:
   - `DATABASE_URL` — Transaction pooler (port `6543`), ends with `?pgbouncer=true`.
   - `DIRECT_URL` — Session pooler / direct (port `5432`), used by `prisma db push`.
3. Run `npm run setup` to create the tables.

The database starts empty. Create an account at `/register` — you begin with a set of
default categories and two starter accounts (a bank account and cash), ready to record
your first transaction.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm run start` | Run the production build |
| `npm run test` | Run the financial-logic test suite (Vitest) |
| `npm run db:push` | Sync the Prisma schema to Postgres |
| `npm run db:reset` | Reset the DB to an empty schema |
| `npm run setup` | generate + push (empty DB) in one step |

## Deploying

The app is a standard Next.js server and can run on any Node host (Vercel, Fly, a
container, etc.). The database is Supabase (hosted Postgres) — see [Database](#database-supabase).

**1. Set environment variables on the host.** `.env` is gitignored, so it is *not*
shipped with the code — configure these in your host's environment settings:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler** (port `6543`), ending in `?pgbouncer=true`. Used by the app at runtime. |
| `DIRECT_URL` | Supabase **session pooler / direct** (port `5432`). Used only by `prisma db push`. |
| `AUTH_SECRET` | A long random string (32+ chars). Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |

**2. Build.** `npm run build` runs `prisma generate` then `next build`.

**3. Apply the schema to the database** once (from your machine or a deploy step),
against the target project's connection strings:

```bash
npm run db:push
```

Notes:

- On serverless (e.g. Vercel), always use the **pooled** `DATABASE_URL` (`6543`) so
  functions don't exhaust direct connections. `DIRECT_URL` is only for schema pushes.
- Changing `AUTH_SECRET` invalidates all existing sessions (everyone must sign in again).
- Never commit real secrets. Keep them in the host's env config and in your local
  gitignored `.env`; `.env.example` documents the shape with placeholders.

## Money is never a float

All monetary values are stored and computed as **integer paise** (1 rupee = 100 paise).
Rupee values are only produced for display via `formatINR` / the `<Money>` component, which
uses the Indian numbering system (`₹1,00,000`).

## Architecture

Clean separation of concerns:

- `src/lib/calculations.ts` — pure, dependency-free financial calculations (balance, summaries,
  category totals, budgets, savings rate, date-range filtering). Fully unit-tested.
- `src/lib/analytics.ts` — server-side monthly analytics composed from the calc layer.
- `src/lib/insights.ts` — deterministic insight generation from real aggregates (no AI).
- `src/lib/categorize.ts` — rule-based auto-categorization (no AI required).
- `src/lib/csv.ts` — CSV export + import validation/mapping (pure, tested).
- `src/lib/queries.ts` — server data loaders; `src/lib/tx-service.ts` — transaction business logic.
- `src/lib/auth.ts` — session auth (hashed passwords + DB-backed sessions, httpOnly cookie).
- `src/app/api/**` — REST route handlers (all authenticated + row-isolated per user).
- `src/components/**` — reusable UI kit and feature components; business logic stays out of UI.

## Tests

```bash
npm run test
```

Covers balances, monthly totals, transfers, refunds, savings rate, budgets, date-range
filtering (month/year boundaries, leap years), goal math, CSV import and duplicate detection.

## Security notes

- Every API route requires a valid session and scopes all queries to the current user
  (`userId`), so one user can never see another's data.
- Passwords are hashed with bcrypt; sessions are random tokens stored hashed (SHA-256) in the
  database and delivered as `httpOnly`, `sameSite=lax` cookies.
- Set a strong `AUTH_SECRET` in `.env` for any real deployment.
