import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { pointTransactions } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireApiKeyOrError, serializeTransaction } from "@/lib/v1";

/** GET /api/v1/customers/:id/transactions — the customer's ledger, newest first. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiKeyOrError(req);
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError("not_found", "Customer not found.");
  }

  const rows = await db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.customerId, id))
    .orderBy(desc(pointTransactions.createdAt));

  return jsonOk({ transactions: rows.map(serializeTransaction) });
}
