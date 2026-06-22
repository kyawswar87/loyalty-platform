import { and, eq } from "drizzle-orm";
import type { Transaction } from "@/lib/db";
import { referrals } from "@/db/schema";
import { recordPointChange } from "@/lib/points";

/**
 * Pay the referrer when their referee first earns — exactly once.
 *
 * Flips a single `pending` referral for this referee to `rewarded` with a
 * conditional UPDATE ... WHERE status='pending' RETURNING; that row lock makes
 * the payout idempotent even under concurrent earns (only one update wins).
 * Returns true if a payout was made.
 */
export async function maybePayReferrer(
  tx: Transaction,
  refereeId: string,
): Promise<boolean> {
  const [referral] = await tx
    .update(referrals)
    .set({ status: "rewarded" })
    .where(
      and(eq(referrals.refereeId, refereeId), eq(referrals.status, "pending")),
    )
    .returning();

  if (!referral) return false;

  if (referral.rewardPoints > 0) {
    await recordPointChange(tx, {
      customerId: referral.referrerId,
      type: "referral",
      points: referral.rewardPoints,
      reason: "Referral reward",
      reference: `referral:${referral.id}`,
    });
  }

  return true;
}
