import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { customers, referrals } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { recordPointChange } from "@/lib/points";
import { generateReferralCode } from "@/lib/vouchers";
import { getProgramConfig } from "@/lib/program";
import {
  mapEngineError,
  requireApiKeyOrError,
  serializeCustomer,
} from "@/lib/v1";

const createSchema = z.object({
  externalId: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  // Referral code of an existing customer who referred this one.
  referralCode: z.string().min(1).max(32).optional(),
});

/**
 * POST /api/v1/customers — create a customer (idempotent on `external_id`).
 *
 * A repeat call with the same `external_id` returns the existing customer with
 * no side effects (200). A new customer (201) gets a generated `referral_code`,
 * the configured signup bonus, and — if a valid `referralCode` was supplied — a
 * `pending` referral plus the referee welcome bonus.
 */
export async function POST(req: Request) {
  const unauthorized = await requireApiKeyOrError(req, { rateLimit: true });
  if (unauthorized) return unauthorized;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("bad_request", "Invalid request body.");
  }
  const body = parsed.data;
  const config = await getProgramConfig();

  try {
    const result = await db.transaction(async (tx) => {
      const referrer = body.referralCode
        ? (
            await tx
              .select()
              .from(customers)
              .where(eq(customers.referralCode, body.referralCode))
              .limit(1)
          )[0]
        : undefined;

      const [created] = await tx
        .insert(customers)
        .values({
          externalId: body.externalId,
          email: body.email ?? null,
          referralCode: generateReferralCode(),
          referredBy: referrer?.id ?? null,
        })
        .onConflictDoNothing({ target: customers.externalId })
        .returning();

      // Idempotent replay: customer already existed → return it untouched.
      if (!created) {
        const [existing] = await tx
          .select()
          .from(customers)
          .where(eq(customers.externalId, body.externalId))
          .limit(1);
        return { customer: existing, createdNew: false };
      }

      if (config.signupBonus > 0) {
        await recordPointChange(tx, {
          customerId: created.id,
          type: "adjust",
          points: config.signupBonus,
          reason: "Signup bonus",
        });
      }

      if (referrer && referrer.id !== created.id) {
        await tx.insert(referrals).values({
          referrerId: referrer.id,
          refereeId: created.id,
          status: "pending",
          rewardPoints: config.referralReferrerPoints,
        });
        if (config.referralRefereePoints > 0) {
          await recordPointChange(tx, {
            customerId: created.id,
            type: "referral",
            points: config.referralRefereePoints,
            reason: "Referral welcome bonus",
            reference: `referrer:${referrer.id}`,
          });
        }
      }

      const [fresh] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, created.id))
        .limit(1);
      return { customer: fresh, createdNew: true };
    });

    return jsonOk(
      serializeCustomer(result.customer),
      result.createdNew ? 201 : 200,
    );
  } catch (err) {
    const mapped = mapEngineError(err);
    if (mapped) return mapped;
    throw err;
  }
}
