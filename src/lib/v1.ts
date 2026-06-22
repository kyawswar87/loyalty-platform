import { jsonError } from "@/lib/api";
import { requireApiKey } from "@/lib/apiKey";
import { rateLimit } from "@/lib/rateLimit";
import {
  CustomerNotFoundError,
  InsufficientBalanceError,
  type PointTransaction,
} from "@/lib/points";
import type { customers, redemptions } from "@/db/schema";

/**
 * API-key gate for `/api/v1/*`. Returns `null` when authorized, otherwise the
 * error response (401 unauthorized, or 429 when `rateLimit` is set and the
 * per-key window is exhausted) to return directly. Pass `{ rateLimit: true }` on
 * mutation endpoints.
 */
export async function requireApiKeyOrError(
  req: Request,
  opts?: { rateLimit?: boolean },
): Promise<Response | null> {
  const auth = await requireApiKey(req);
  if (!auth.ok) {
    return jsonError("unauthorized", "Invalid or missing API key.");
  }

  if (opts?.rateLimit) {
    const result = rateLimit(`apikey:${auth.apiKey.id}`);
    if (!result.ok) {
      const res = jsonError("rate_limited", "Too many requests.");
      res.headers.set("Retry-After", String(result.retryAfter));
      return res;
    }
  }

  return null;
}

/** Reward is inactive, missing, or out of stock. */
export class RewardUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewardUnavailableError";
  }
}

/**
 * Map a thrown engine error to a JSON error response. Returns `null` for
 * anything unrecognized so the caller can rethrow (→ 500).
 */
export function mapEngineError(err: unknown): Response | null {
  if (err instanceof CustomerNotFoundError) {
    return jsonError("not_found", "Customer not found.");
  }
  if (err instanceof InsufficientBalanceError) {
    return jsonError("unprocessable", "Insufficient points balance.");
  }
  if (err instanceof RewardUnavailableError) {
    return jsonError("unprocessable", err.message);
  }
  return null;
}

type Customer = typeof customers.$inferSelect;
type Redemption = typeof redemptions.$inferSelect;

export function serializeCustomer(c: Customer) {
  return {
    id: c.id,
    externalId: c.externalId,
    email: c.email,
    pointsBalance: c.pointsBalance,
    referralCode: c.referralCode,
    referredBy: c.referredBy,
    createdAt: c.createdAt,
  };
}

export function serializeTransaction(t: PointTransaction) {
  return {
    id: t.id,
    customerId: t.customerId,
    type: t.type,
    points: t.points,
    amount: t.amount,
    reason: t.reason,
    reference: t.reference,
    balanceAfter: t.balanceAfter,
    createdAt: t.createdAt,
  };
}

export function serializeRedemption(r: Redemption) {
  return {
    id: r.id,
    customerId: r.customerId,
    rewardId: r.rewardId,
    pointsSpent: r.pointsSpent,
    voucherCode: r.voucherCode,
    status: r.status,
    createdAt: r.createdAt,
  };
}
