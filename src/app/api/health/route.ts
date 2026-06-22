import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Liveness + DB connectivity check. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return jsonOk({ ok: true, db: "up" });
  } catch {
    return jsonError("internal", "database unreachable", 503);
  }
}
