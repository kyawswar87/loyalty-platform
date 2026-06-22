/**
 * Balance integrity check (CLI). Verifies every customer's points_balance equals
 * the sum of their ledger entries. Exits non-zero if any mismatch is found, so it
 * can gate a deploy. Run with: `npm run check:integrity`.
 */
import { config } from "dotenv";
import { findBalanceMismatches } from "../src/lib/integrity";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  const mismatches = await findBalanceMismatches();
  if (mismatches.length === 0) {
    console.log("✓ Balances reconcile with the ledger.");
    process.exit(0);
  }

  console.error(`✗ ${mismatches.length} balance mismatch(es):`);
  for (const m of mismatches) {
    console.error(
      `  ${m.externalId} (${m.customerId}): balance=${m.balance} ledger=${m.ledgerSum}`,
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
