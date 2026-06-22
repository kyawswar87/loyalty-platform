import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { redemptions } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireApiKeyOrError, serializeRedemption } from "@/lib/v1";

/**
 * POST /api/v1/redemptions/:id/use — mark an issued voucher as `used`.
 *
 * Conditional update on `status='issued'` so a voucher is consumed at most once.
 * Already-used/void → 409; unknown id → 404.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiKeyOrError(req, { rateLimit: true });
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError("not_found", "Redemption not found.");
  }

  const [updated] = await db
    .update(redemptions)
    .set({ status: "used" })
    .where(and(eq(redemptions.id, id), eq(redemptions.status, "issued")))
    .returning();

  if (updated) return jsonOk({ redemption: serializeRedemption(updated) });

  const [existing] = await db
    .select()
    .from(redemptions)
    .where(eq(redemptions.id, id))
    .limit(1);

  if (!existing) return jsonError("not_found", "Redemption not found.");
  return jsonError("conflict", `Voucher is ${existing.status}, not issued.`);
}
