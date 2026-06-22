import { eq } from "drizzle-orm";
import type { Transaction } from "@/lib/db";
import { customers, pointTransactions } from "@/db/schema";

export type PointTransaction = typeof pointTransactions.$inferSelect;
export type TransactionType = PointTransaction["type"];

/** Customer referenced by a point change does not exist. */
export class CustomerNotFoundError extends Error {
  constructor() {
    super("customer not found");
    this.name = "CustomerNotFoundError";
  }
}

/** A spend would push the balance below zero. */
export class InsufficientBalanceError extends Error {
  constructor() {
    super("insufficient points balance");
    this.name = "InsufficientBalanceError";
  }
}

export type PointChange = {
  customerId: string;
  type: TransactionType;
  /** Signed: positive to credit, negative to debit. */
  points: number;
  /** Original purchase value for `earn` (audit); numeric column → string. */
  amount?: string | null;
  reason?: string | null;
  reference?: string | null;
  actorUserId?: string | null;
  idempotencyKey?: string | null;
};

export type PointChangeResult = {
  transaction: PointTransaction;
  balanceAfter: number;
};

/** Points earned for a purchase: `floor(amount * earnRate)`. */
export function pointsForAmount(amount: number, earnRate: number): number {
  return Math.floor(amount * earnRate);
}

/**
 * Append one ledger row and move the customer's denormalized balance in lock
 * step — the single primitive every earn/redeem/referral/adjust goes through.
 *
 * Must run inside a `db.transaction(...)`. Locks the customer row (`FOR UPDATE`)
 * so concurrent mutations serialize, then writes the ledger entry (stamped with
 * `balanceAfter`) and updates `points_balance` in the same transaction. Throws
 * {@link InsufficientBalanceError} if the result would be negative.
 */
export async function recordPointChange(
  tx: Transaction,
  change: PointChange,
): Promise<PointChangeResult> {
  const [customer] = await tx
    .select({ id: customers.id, balance: customers.pointsBalance })
    .from(customers)
    .where(eq(customers.id, change.customerId))
    .for("update");

  if (!customer) throw new CustomerNotFoundError();

  const balanceAfter = customer.balance + change.points;
  if (balanceAfter < 0) throw new InsufficientBalanceError();

  const [transaction] = await tx
    .insert(pointTransactions)
    .values({
      customerId: change.customerId,
      type: change.type,
      points: change.points,
      amount: change.amount ?? null,
      reason: change.reason ?? null,
      reference: change.reference ?? null,
      balanceAfter,
      actorUserId: change.actorUserId ?? null,
      idempotencyKey: change.idempotencyKey ?? null,
    })
    .returning();

  await tx
    .update(customers)
    .set({ pointsBalance: balanceAfter })
    .where(eq(customers.id, change.customerId));

  return { transaction, balanceAfter };
}
