import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { redemptions, rewards } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { recordPointChange } from "@/lib/points";
import { generateVoucherCode } from "@/lib/vouchers";
import {
  findRedemptionByIdempotencyKey,
  idempotencyKeyOf,
  isUniqueViolation,
} from "@/lib/idempotency";
import {
  RewardUnavailableError,
  mapEngineError,
  requireApiKeyOrError,
  serializeRedemption,
} from "@/lib/v1";

const redeemSchema = z.object({
  customerId: z.string().uuid(),
  rewardId: z.string().uuid(),
});

/**
 * POST /api/v1/redemptions — spend points for a reward voucher.
 *
 * In one DB transaction: lock the reward, verify it's active + in stock + the
 * customer can afford it, debit points via a negative `redeem` ledger row,
 * decrement stock, and issue a unique `voucher_code` (`issued`). Insufficient
 * balance → 422. Idempotent on the `Idempotency-Key` header.
 */
export async function POST(req: Request) {
  const unauthorized = await requireApiKeyOrError(req, { rateLimit: true });
  if (unauthorized) return unauthorized;

  const json = await req.json().catch(() => null);
  const parsed = redeemSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("bad_request", "Invalid request body.");
  }
  const { customerId, rewardId } = parsed.data;
  const idempotencyKey = idempotencyKeyOf(req);

  if (idempotencyKey) {
    const existing = await findRedemptionByIdempotencyKey(idempotencyKey);
    if (existing) {
      return jsonOk({ redemption: serializeRedemption(existing) });
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [reward] = await tx
        .select()
        .from(rewards)
        .where(eq(rewards.id, rewardId))
        .for("update");

      if (!reward || !reward.active) {
        throw new RewardUnavailableError("Reward is not available.");
      }
      if (reward.stock !== null && reward.stock <= 0) {
        throw new RewardUnavailableError("Reward is out of stock.");
      }

      const { balanceAfter } = await recordPointChange(tx, {
        customerId,
        type: "redeem",
        points: -reward.pointsCost,
        reason: `Redeemed ${reward.name}`,
        idempotencyKey,
      });

      if (reward.stock !== null) {
        await tx
          .update(rewards)
          .set({ stock: reward.stock - 1 })
          .where(eq(rewards.id, reward.id));
      }

      const [redemption] = await tx
        .insert(redemptions)
        .values({
          customerId,
          rewardId: reward.id,
          pointsSpent: reward.pointsCost,
          voucherCode: generateVoucherCode(),
          status: "issued",
          idempotencyKey,
        })
        .returning();

      return { redemption, balance: balanceAfter };
    });

    return jsonOk(
      {
        redemption: serializeRedemption(result.redemption),
        balance: result.balance,
      },
      201,
    );
  } catch (err) {
    if (idempotencyKey && isUniqueViolation(err)) {
      const existing = await findRedemptionByIdempotencyKey(idempotencyKey);
      if (existing) {
        return jsonOk({ redemption: serializeRedemption(existing) });
      }
    }
    const mapped = mapEngineError(err);
    if (mapped) return mapped;
    throw err;
  }
}
