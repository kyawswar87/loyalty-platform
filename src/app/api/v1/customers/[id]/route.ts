import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { customers } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireApiKeyOrError, serializeCustomer } from "@/lib/v1";

/** GET /api/v1/customers/:id — fetch a customer (includes `pointsBalance`). */
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

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (!customer) return jsonError("not_found", "Customer not found.");
  return jsonOk(serializeCustomer(customer));
}
