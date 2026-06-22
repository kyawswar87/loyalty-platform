# Loyalty Platform — MVP Plan (phase by phase)

## Context

We're building the MVP of a loyalty platform for **a single business**. The business
runs a rewards program for its **Customers**: customers earn points on purchases and
referrals, and redeem points for rewards (discounts / free products via voucher codes).
The program is run by the business's **staff**, who have two roles and each get a login
and a dashboard.

### Actors & responsibilities
- **Admin** (business owner / super-admin) — has a **login + admin dashboard**.
  - Manage **operator accounts** (create / disable staff logins, assign roles).
  - Manage all **customers** (view, create, adjust points).
  - Control **global program configuration** (earn rate, referral rewards, signup bonus).
  - View full **analytics** (points issued/redeemed, liability, top rewards, staff activity).
- **Operator** (business staff) — has a **login + operator dashboard**.
  - Manage **customers** (view, search, create, adjust points).
  - Configure **points & rewards** (reward catalog, program settings — per role permission).
  - View the **analytics dashboard**.
- **Customer** (end user) — **no login** in the MVP. Created/identified via the API
  (POS / e-commerce) or by staff in a dashboard. Earns and redeems points.

> Single dataset — **no multi-tenancy**. Access is governed by **role** (Admin vs Operator),
> not by tenant. There is one program, one config, one customer base.

### Stack
- **Next.js** (App Router) on Vercel — Route Handlers for the API **and** dashboard UI.
- **Postgres** (local via Docker Compose; any managed Postgres in prod) using the
  **`pg`** driver + **Drizzle ORM**. **shadcn/ui** + Tailwind for the dashboards.
- **Staff auth:** **Auth.js (NextAuth)** credentials provider + a `users` table with
  hashed passwords and a `role` column. Admin creates operator accounts. *(Swappable for Clerk.)*
- **Customer/POS access:** business **API keys** (`Authorization: Bearer`) for programmatic earn/redeem.

### Design principles
- **Point ledger is the source of truth** (append-only `point_transactions`); each customer
  carries a denormalized `points_balance` updated in the same DB transaction as the ledger insert.
- **Idempotency** on every points mutation (earn / redeem), keyed by a client-supplied
  `Idempotency-Key`, so a POS retry never double-credits.
- **Role-based access control (RBAC):** Admin > Operator. Two auth surfaces: staff sessions
  (dashboards) and API keys (POS).

---

## Phase 0 — Scaffold & tooling

Goal: a running Next.js app with DB, auth, and UI kit wired up.

- `npx create-next-app@latest` (TypeScript, App Router, Tailwind).
- Add **Drizzle** (`drizzle-orm`, `drizzle-kit`) + the **`pg`** driver.
- Start **Postgres** via Docker Compose (`docker compose up -d`); copy `.env.example` to `.env.local`.
- Install **Auth.js** (`next-auth`) + `bcryptjs`, and **shadcn/ui** (`npx shadcn@latest init`).
- `lib/db.ts` (Drizzle client), `lib/api.ts` (JSON response/error envelope), `zod` for validation.
- `drizzle.config.ts` + `npm run db:generate` / `db:migrate` scripts.

**Critical files:** `lib/db.ts`, `lib/api.ts`, `drizzle.config.ts`, `auth.ts` (NextAuth config), `.env`.

**Verify:** `vercel dev` boots; `GET /api/health` runs `SELECT 1` on Postgres; the sign-in page renders.

---

## Phase 1 — Data model & migrations

Goal: the full schema before any business logic.

Tables (`db/schema.ts`):
- `users` (staff) — `id`, `email` (unique), `password_hash`, `name`, `role`
  (`admin|operator`), `status` (`active|disabled`), timestamps.
- `customers` — `id`, `external_id` (unique), `email`, `points_balance` (default 0),
  `referral_code` (unique), `referred_by` (nullable customer id), timestamps.
- `point_transactions` (ledger) — `id`, `customer_id`, `type`
  (`earn|redeem|referral|adjust`), `points` (signed), `reason`, `reference`,
  `balance_after`, `actor_user_id` (nullable — which staff/API made it),
  `idempotency_key` (unique), `created_at`.
- `rewards` — `id`, `name`, `description`, `points_cost`, `active`,
  `stock` (nullable = unlimited), timestamps.
- `redemptions` — `id`, `customer_id`, `reward_id`, `points_spent`,
  `voucher_code` (unique), `status` (`issued|used|void`), `idempotency_key`, `created_at`.
- `referrals` — `id`, `referrer_id`, `referee_id` (unique), `status`
  (`pending|rewarded`), `reward_points`, `created_at`.
- `program_config` — **single row**: `earn_rate`, `referral_referrer_points`,
  `referral_referee_points`, `signup_bonus`, `currency`.
- `api_keys` — `id`, `hashed_key`, `label`, `active`, `last_used_at`.

**Critical files:** `db/schema.ts`, generated migration under `drizzle/`.

**Verify:** `npm run db:migrate` applies cleanly; tables visible via `npm run db:studio` or psql.

---

## Phase 2 — Staff auth, RBAC & API-key auth

Goal: logins for Admin/Operator, role enforcement, and POS API-key auth.

- **Staff auth (Auth.js):** credentials provider validates `email` + `password_hash`;
  session carries `{ userId, role }`. Sign-in page at `/login`; sign-out.
- **RBAC helper** (`lib/authz.ts`): `requireRole('admin' | 'operator')` for server actions /
  route handlers; Admin inherits all Operator permissions.
- **Route protection** (`middleware.ts`): gate `/admin/*` (admin only) and `/dashboard/*`
  (admin + operator). Unauthenticated → `/login`.
- **API-key auth** (`lib/apiKey.ts`): `Authorization: Bearer <key>` → hash → match `api_keys`;
  reject 401 if missing/inactive; touch `last_used_at`. Used by all `/api/v1/*` POS endpoints.
- **Bootstrap:** seed/CLI to create the first **Admin** account.

**Critical files:** `auth.ts`, `lib/authz.ts`, `lib/apiKey.ts`, `middleware.ts`,
`app/login/page.tsx`.

**Verify:** seed an admin → log in → reach `/admin`; an operator account cannot reach `/admin`
(redirect/403) but can reach `/dashboard`; a valid API key authorizes `/api/v1/*`, an invalid one → 401.

---

## Phase 3 — Loyalty engine (POS-facing API, `/api/v1/*`)

Goal: the core earn / refer / redeem engine behind API-key auth.

- **Customers** — `POST /api/v1/customers` (create, idempotent on `external_id`, generate
  `referral_code`, optional `signup_bonus`); `GET /api/v1/customers/:id` (+ balance);
  `GET /api/v1/customers/:id/transactions`.
- **Earn** — `POST /api/v1/transactions`: body `customer_id`, `amount`, optional `reference`,
  `Idempotency-Key` header. `points = floor(amount * earn_rate)`; ledger insert + balance bump
  in **one DB transaction**; duplicate idempotency key returns the original result.
  - **Hook:** referee's first earn → pay out referrer.
- **Referrals** — `referral_code` accepted at customer creation: set `referred_by`, create a
  `referrals` row (`pending`), credit referee welcome points. On the referee's first earn, credit
  referrer points (`type=referral`) and flip to `rewarded` — guarded to fire exactly once.
- **Redemption** — `POST /api/v1/redemptions`: verify reward active + stock + balance, deduct via
  a negative `type=redeem` ledger row, decrement stock, issue a unique `voucher_code`,
  `status=issued` — all in one transaction; 422 on insufficient balance.
  `POST /api/v1/redemptions/:id/use` marks the voucher `used`.

Reuse: `lib/points.ts` (single transactional earn/spend/credit primitive),
`lib/idempotency.ts`, `lib/vouchers.ts`, `lib/referrals.ts`.

**Critical files:** `app/api/v1/customers/...`, `app/api/v1/transactions/route.ts`,
`app/api/v1/redemptions/...`, `lib/points.ts`, `lib/idempotency.ts`, `lib/referrals.ts`, `lib/vouchers.ts`.

**Verify:** create customer → earn (balance up by `floor(amount*earn_rate)`) → idempotent replay
(no change) → refer + first purchase (referrer paid once) → redeem (balance down, voucher) →
insufficient balance → 422.

---

## Phase 4 — Operator dashboard (`/dashboard/*`)

Goal: staff self-serve the day-to-day program. Shared by Admin and Operator.

- **Customers:** searchable list, detail view (balance + ledger), manual point `adjust`
  (`type=adjust`, stamped with `actor_user_id`), manual customer create.
- **Rewards:** CRUD reward catalog (name, cost, stock, active toggle).
- **Program settings:** edit `earn_rate`, referral rewards, signup bonus, currency
  (`program_config`) — editable per role permission.
- **Redemptions:** list issued vouchers + status; mark used.

Reuse: the same server-side `lib/points.ts` the API uses — dashboard mutations go through
identical primitives so balances stay consistent.

**Critical files:** `app/dashboard/(customers|rewards|settings|redemptions)/page.tsx`,
`app/dashboard/actions.ts`.

**Verify:** an operator logs in, finds a customer, adjusts points (ledger entry stamped with their
user id), creates a reward, and edits the earn rate.

---

## Phase 5 — Admin dashboard (`/admin/*`)

Goal: the Admin's control surface — everything an operator has, plus staff management.

- **Operator/staff management:** list staff, **create operator accounts** (email + temp password
  or invite), edit role, **disable/re-enable** logins.
- **API keys:** create/revoke business API keys (show plaintext once; store hash only).
- **Full analytics** (admin view): points issued vs redeemed, **points liability** (sum of
  outstanding balances), top rewards, redemptions over time, staff activity (adjust counts).
- Admin also has full access to everything in `/dashboard/*`.

**Critical files:** `app/admin/(staff|api-keys|analytics)/page.tsx`, `app/admin/actions.ts`.

**Verify:** admin creates an operator account → that operator can log in and use `/dashboard`;
admin disables the account → that operator can no longer log in. Admin can create/revoke an API key.

---

## Phase 6 — Analytics, hardening & docs (MVP exit)

Goal: useful dashboards + safe to put in front of real staff.

- **Analytics queries** (`lib/analytics.ts`): active customers, points liability, points
  issued/redeemed over time, top rewards; render with simple charts (e.g. `recharts`).
- **Balance integrity check:** assert `points_balance == SUM(point_transactions.points)` per customer;
  negative-balance guard on all spends.
- **Rate limiting** on `/api/v1/*` mutations (per API key); consistent JSON error contract
  (`{error:{code,message}}`) + correct status codes.
- **Seed script:** first admin, `program_config`, a demo reward, a demo API key.
- **Docs:** `README` / OpenAPI for `/api/v1/*` (auth header, `Idempotency-Key` convention).
- **Tests:** Vitest for `lib/points.ts` (earn/redeem/referral/adjust math + idempotency) +
  an integration pass over the happy paths.
- Deploy preview via `vercel deploy`.

**Verify:** full run — admin sets up config + reward + API key + an operator account → POS
earns/refers/redeems via API → operator adjusts a customer in the dashboard → analytics reflect
it all → integrity check reconciles balances with the ledger.

---

## Out of scope for MVP (future phases)
- **VIP tiers** (Silver/Gold/Platinum by lifetime spend) + tier-based earn multipliers/perks.
- Customer-facing wallet/app; points expiry; campaigns/bonus events.
- Omnichannel connectors (Shopify/POS webhooks) — `/api/v1/*` is the integration point for now.
- Fine-grained operator permissions beyond the Admin/Operator split; password reset emails (use temp passwords in MVP).

## Key reuse map
- `lib/points.ts` — single transactional earn/spend/credit primitive (API + dashboards).
- `lib/authz.ts` / `lib/apiKey.ts` — staff RBAC and POS API-key auth.
- `lib/idempotency.ts`, `lib/vouchers.ts`, `lib/referrals.ts`, `lib/analytics.ts` — shared engine helpers.
- `lib/api.ts` — JSON response/error envelope for all handlers.
