import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type BalanceMismatch = {
  customerId: string;
  externalId: string;
  balance: number;
  ledgerSum: number;
};

/**
 * Balance integrity check: every customer's denormalized `points_balance` must
 * equal the sum of their ledger entries. Returns the rows that disagree (empty =
 * healthy). The ledger is the source of truth, so any mismatch is a bug.
 */
export async function findBalanceMismatches(): Promise<BalanceMismatch[]> {
  const result = await db.execute(sql`
    SELECT c.id AS customer_id,
           c.external_id,
           c.points_balance AS balance,
           COALESCE(SUM(t.points), 0)::int AS ledger_sum
    FROM customers c
    LEFT JOIN point_transactions t ON t.customer_id = c.id
    GROUP BY c.id, c.external_id, c.points_balance
    HAVING c.points_balance <> COALESCE(SUM(t.points), 0)
    ORDER BY c.external_id
  `);

  const rows = (result as { rows: Record<string, unknown>[] }).rows ?? [];
  return rows.map((r) => ({
    customerId: String(r.customer_id),
    externalId: String(r.external_id),
    balance: Number(r.balance),
    ledgerSum: Number(r.ledger_sum),
  }));
}
