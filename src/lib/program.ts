import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { programConfig } from "@/db/schema";

export type ProgramConfig = typeof programConfig.$inferSelect;

/**
 * Read the singleton `program_config` row (id = 1). Seeded by `npm run db:seed`.
 * `earnRate` is a numeric column (string); use {@link earnRateOf} for the number.
 */
export async function getProgramConfig(): Promise<ProgramConfig> {
  const cfg = await db.query.programConfig.findFirst({
    where: eq(programConfig.id, 1),
  });
  if (!cfg) {
    throw new Error("program_config row missing — run `npm run db:seed`");
  }
  return cfg;
}

/** Parse the numeric `earn_rate` string into a number. */
export function earnRateOf(cfg: ProgramConfig): number {
  return Number(cfg.earnRate);
}
