/**
 * Drizzle schema for the loyalty platform (single-business, role-based).
 *
 * Design notes:
 * - The point ledger (`point_transactions`) is the source of truth; each
 *   customer carries a denormalized `points_balance` kept in sync inside the
 *   same DB transaction as the ledger insert.
 * - `idempotency_key` columns make points mutations safe to retry.
 * - `program_config` is a singleton row (enforced by a CHECK on a fixed id).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRole = pgEnum("user_role", ["admin", "operator"]);
export const userStatus = pgEnum("user_status", ["active", "disabled"]);
export const transactionType = pgEnum("transaction_type", [
  "earn",
  "redeem",
  "referral",
  "adjust",
]);
export const redemptionStatus = pgEnum("redemption_status", [
  "issued",
  "used",
  "void",
]);
export const referralStatus = pgEnum("referral_status", [
  "pending",
  "rewarded",
]);

// Reusable timestamp columns.
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Staff users (dashboard logins)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRole("role").notNull().default("operator"),
  status: userStatus("status").notNull().default("active"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Customers (end users — no login)
// ---------------------------------------------------------------------------
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  // The business's own id for this customer (e.g. POS / e-commerce id).
  externalId: varchar("external_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  pointsBalance: integer("points_balance").notNull().default(0),
  referralCode: varchar("referral_code", { length: 32 }).notNull().unique(),
  referredBy: uuid("referred_by"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Point ledger (append-only source of truth)
// ---------------------------------------------------------------------------
export const pointTransactions = pgTable(
  "point_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    type: transactionType("type").notNull(),
    // Signed: positive for earn/referral/adjust-up, negative for redeem.
    points: integer("points").notNull(),
    // Original purchase value for `earn` (audit / analytics). Null otherwise.
    amount: numeric("amount", { precision: 12, scale: 2 }),
    reason: text("reason"),
    // External correlation id (e.g. order id).
    reference: varchar("reference", { length: 255 }),
    // Customer balance immediately after this entry.
    balanceAfter: integer("balance_after").notNull(),
    // Which staff user performed this (null for API-key / system actions).
    actorUserId: uuid("actor_user_id").references(() => users.id),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Unique only over non-null keys (Postgres treats NULLs as distinct).
    uniqueIndex("point_transactions_idempotency_key_uq").on(t.idempotencyKey),
  ],
);

// ---------------------------------------------------------------------------
// Rewards catalog
// ---------------------------------------------------------------------------
export const rewards = pgTable("rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  active: boolean("active").notNull().default(true),
  // Null = unlimited stock.
  stock: integer("stock"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Redemptions (points spent → voucher)
// ---------------------------------------------------------------------------
export const redemptions = pgTable(
  "redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id),
    pointsSpent: integer("points_spent").notNull(),
    voucherCode: varchar("voucher_code", { length: 32 }).notNull().unique(),
    status: redemptionStatus("status").notNull().default("issued"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("redemptions_idempotency_key_uq").on(t.idempotencyKey),
  ],
);

// ---------------------------------------------------------------------------
// Referrals (one per referee)
// ---------------------------------------------------------------------------
export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id")
    .notNull()
    .references(() => customers.id),
  refereeId: uuid("referee_id")
    .notNull()
    .unique()
    .references(() => customers.id),
  status: referralStatus("status").notNull().default("pending"),
  rewardPoints: integer("reward_points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Program configuration (singleton row)
// ---------------------------------------------------------------------------
export const programConfig = pgTable(
  "program_config",
  {
    id: integer("id").primaryKey().default(1),
    // Points earned per 1 unit of currency spent.
    earnRate: numeric("earn_rate", { precision: 12, scale: 4 })
      .notNull()
      .default("1"),
    referralReferrerPoints: integer("referral_referrer_points")
      .notNull()
      .default(0),
    referralRefereePoints: integer("referral_referee_points")
      .notNull()
      .default(0),
    signupBonus: integer("signup_bonus").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    ...timestamps,
  },
  (t) => [check("program_config_singleton", sql`${t.id} = 1`)],
);

// ---------------------------------------------------------------------------
// API keys (POS / e-commerce programmatic access)
// ---------------------------------------------------------------------------
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  hashedKey: text("hashed_key").notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  ...timestamps,
});
