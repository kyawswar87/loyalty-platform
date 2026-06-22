import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pointTransactions, redemptions } from "@/db/schema";

/**
 * Idempotency for POS retries. Clients send an `Idempotency-Key` header on every
 * points mutation; we persist it on the resulting row (unique index) and replay
 * the original result instead of applying the change twice.
 */
export function idempotencyKeyOf(req: Request): string | null {
  const key = req.headers.get("idempotency-key");
  return key && key.trim() ? key.trim() : null;
}

export async function findTransactionByIdempotencyKey(key: string) {
  return db.query.pointTransactions.findFirst({
    where: eq(pointTransactions.idempotencyKey, key),
  });
}

export async function findRedemptionByIdempotencyKey(key: string) {
  return db.query.redemptions.findFirst({
    where: eq(redemptions.idempotencyKey, key),
  });
}

/** Postgres unique-violation (e.g. a concurrent request won the idempotency race). */
export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } })?.code;
  const causeCode = (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}
