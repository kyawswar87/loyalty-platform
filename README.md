# Loyalty Platform

MVP of a points-based loyalty program for a **single business**. Customers earn
points on purchases and referrals and redeem them for rewards (voucher codes).
The program is run by staff with two roles — **Admin** and **Operator** — each
with a login and dashboard. Customers have no login; they're created and updated
through the POS/e-commerce API.

See [`MVP-PLAN.md`](./MVP-PLAN.md) for the full phase-by-phase roadmap.

## Stack

- **Next.js 16** (App Router) — dashboards + API route handlers
- **Postgres** via `pg` driver + **Drizzle ORM** (local Postgres in Docker)
- **Auth.js (NextAuth v5)** — staff credentials login with role-based access
- **API keys** (`Authorization: Bearer`) — programmatic POS/e-commerce access
- **shadcn/ui** + Tailwind CSS

## Getting Started

### 1. Start Postgres

```bash
docker compose up -d
```

Runs `postgres:17-alpine`, exposed on host port **5434** (see
[`docker-compose.yml`](./docker-compose.yml)).

### 2. Configure environment

```bash
cp .env.example .env.local
```

Then set the values in `.env.local`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string (default matches Docker Compose) |
| `AUTH_SECRET` | Auth.js session secret — generate with `npx auth secret` |
| `ADMIN_EMAIL` | First admin account, created by the seed |
| `ADMIN_PASSWORD` | First admin password (re-running the seed resets it) |
| `CHAT_STREAM_URL` | External AI backend SSE endpoint for the chat assistant (defaults to `http://localhost:8080/api/chat/stream`) |

### 3. Migrate and seed

```bash
npm run db:migrate   # apply the schema
npm run db:seed      # create the admin, program config, and a demo API key
```

The seed is idempotent. It prints the demo API key's plaintext **once** — store
it then, as only its hash is kept.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root redirects to
`/dashboard`, which sends you to `/login` when signed out.

## Accounts

Staff accounts come from the seed — there is no public sign-up.

- **Admin** — defined by `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.local`.
  Re-running `npm run db:seed` upserts on the email and **resets the password**,
  which is the way to recover a forgotten admin login.
- **Operators** — created by an admin from the admin dashboard (not yet built —
  Phase 5).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with ESLint |
| `npm run db:generate` | Generate a Drizzle migration from the schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push the schema directly (dev convenience) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed the admin, program config, demo API key, and demo reward |
| `npm run check:integrity` | Assert every customer balance reconciles with the ledger |

## Health check

`GET /api/health` runs `SELECT 1` against Postgres and returns
`{ ok: true, db: "up" }`, or a 503 if the database is unreachable.

## POS API (`/api/v1/*`)

Programmatic earn / refer / redeem for POS / e-commerce. Every request needs an
API key: `Authorization: Bearer <key>` (seed prints a demo key once). Mutations
accept an optional `Idempotency-Key` header so a retry never double-applies, and
are rate-limited per API key (60/min; `429` with a `Retry-After` header when
exceeded). Errors use the `{ error: { code, message } }` envelope. A machine-
readable spec lives in [`docs/openapi.yaml`](./docs/openapi.yaml).

| Method & path | Purpose |
|---------------|---------|
| `POST /api/v1/customers` | Create a customer (idempotent on `externalId`); optional `referralCode` captures a referral; applies signup bonus |
| `GET /api/v1/customers/:id` | Fetch a customer incl. `pointsBalance` |
| `GET /api/v1/customers/:id/transactions` | The customer's point ledger, newest first |
| `POST /api/v1/transactions` | Record an earn — `points = floor(amount * earn_rate)`; pays the referrer on the referee's first earn |
| `POST /api/v1/redemptions` | Spend points for a reward voucher (checks active/stock/balance; `422` if too few points) |
| `POST /api/v1/redemptions/:id/use` | Mark an issued voucher `used` |

Example earn:

```bash
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer <key>" \
  -H "Idempotency-Key: order-123" \
  -d '{"customerId":"<uuid>","amount":100,"reference":"order-123"}'
```

The engine is built on shared primitives reused by the dashboards later:
`lib/points.ts` (transactional ledger + balance), `lib/referrals.ts`,
`lib/vouchers.ts`, `lib/idempotency.ts`, `lib/program.ts`.

## Operator dashboard (`/dashboard/*`)

Staff-facing UI behind the credentials login (Admin + Operator). All mutations go
through the same `lib/points.ts` primitive the POS API uses, so balances stay
consistent, and point changes are stamped with the acting staff user's id.

- **Overview** — headline counts (customers, points liability, active rewards, open vouchers)
- **Customers** — searchable list, manual create, detail view with balance, full ledger, and manual point adjust
- **Rewards** — create rewards and activate/deactivate them
- **Redemptions** — list issued vouchers and mark them used
- **Settings** — edit `program_config` (earn rate, referral rewards, signup bonus, currency)

## Admin dashboard (`/admin/*`)

Admin-only surface (operators are redirected to `/dashboard`). Admins also have
full operator access.

- **Analytics** — points issued vs redeemed, points liability, top rewards, staff activity
- **Staff** — create accounts (operator or admin), change role, enable/disable logins (you can't lock yourself out)
- **API keys** — create business keys (plaintext shown once, only the hash is stored) and revoke them

## Chat assistant

A floating assistant is available on every staff page (dashboard and admin). Click
the launcher in the bottom-right corner to open a chat panel and ask questions; the
answer **streams in token-by-token**.

- **Backend** — questions are proxied to an external AI service over Server-Sent
  Events. Set `CHAT_STREAM_URL` to its streaming endpoint (the service must be
  running). The proxy (`POST /api/chat`, `src/app/api/chat/route.ts`) is staff-only:
  it rejects unauthenticated requests with `401` and returns `503` when the AI
  backend is unavailable.
- **Single-turn & ephemeral** — each question is independent (no conversation
  memory yet), and history lives only in the browser tab — it clears on reload.

The SSE parsing core lives in `src/lib/chat.ts` (`parseSseBuffer`) and is unit-tested.

## Project status

Roughly the first 2–3 of 7 planned phases are in place:

- ✅ **Phase 0** — scaffold, tooling, Docker Postgres, health route
- ✅ **Phase 1** — full data model (8 tables) + first migration
- 🟡 **Phase 2** — staff auth, RBAC, and API-key auth (working; login at `/login`)
- ✅ **Phase 3** — loyalty engine (`/api/v1/*`: earn / refer / redeem)
- ✅ **Phase 4** — operator dashboard
- ✅ **Phase 5** — admin dashboard (staff + API key management, analytics)
- ✅ **Phase 6** — analytics charts, rate limiting, balance integrity, tests, docs

This completes the MVP. Remaining hardening before production: move the rate
limiter to a shared store (Redis/Upstash) for multi-instance deploys, add
structured request logging, and a deploy pipeline.
