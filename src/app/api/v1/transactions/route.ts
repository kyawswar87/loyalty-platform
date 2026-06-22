import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { pointsForAmount, recordPointChange } from "@/lib/points";
import { maybePayReferrer } from "@/lib/referrals";
import { earnRateOf, getProgramConfig } from "@/lib/program";
import {
  findTransactionByIdempotencyKey,
  idempotencyKeyOf,
  isUniqueViolation,
} from "@/lib/idempotency";
import {
  mapEngineError,
  requireApiKeyOrError,
  serializeTransaction,
} from "@/lib/v1";

const earnSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  reference: z.string().max(255).optional(),
});

/**
 * POST /api/v1/transactions — record an earn.
 *
 * `points = floor(amount * earn_rate)`; the ledger insert and balance bump run
 * in one DB transaction. With an `Idempotency-Key` header, a retry replays the
 * original result instead of double-crediting. On the customer's first earn, the
 * referral payout hook ({@link maybePayReferrer}) pays their referrer once.
 */
export async function POST(req: Request) {
  const unauthorized = await requireApiKeyOrError(req, { rateLimit: true });
  if (unauthorized) return unauthorized;

  const json = await req.json().catch(() => null);
  const parsed = earnSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("bad_request", "Invalid request body.");
  }
  const { customerId, amount, reference } = parsed.data;
  const idempotencyKey = idempotencyKeyOf(req);

  if (idempotencyKey) {
    const existing = await findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      return jsonOk({
        transaction: serializeTransaction(existing),
        balance: existing.balanceAfter,
      });
    }
  }

  const config = await getProgramConfig();
  const points = pointsForAmount(amount, earnRateOf(config));

  try {
    const result = await db.transaction(async (tx) => {
      const { transaction, balanceAfter } = await recordPointChange(tx, {
        customerId,
        type: "earn",
        points,
        amount: String(amount),
        reference: reference ?? null,
        idempotencyKey,
      });
      const referrerPaid = await maybePayReferrer(tx, customerId);
      return { transaction, balanceAfter, referrerPaid };
    });

    return jsonOk({
      transaction: serializeTransaction(result.transaction),
      balance: result.balanceAfter,
      referrerPaid: result.referrerPaid,
    });
  } catch (err) {
    // Concurrent duplicate won the idempotency race → replay the original.
    if (idempotencyKey && isUniqueViolation(err)) {
      const existing = await findTransactionByIdempotencyKey(idempotencyKey);
      if (existing) {
        return jsonOk({
          transaction: serializeTransaction(existing),
          balance: existing.balanceAfter,
        });
      }
    }
    const mapped = mapEngineError(err);
    if (mapped) return mapped;
    throw err;
  }
}
