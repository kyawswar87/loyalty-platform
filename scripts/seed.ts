/**
 * Bootstrap seed: first Admin account, program config, and a demo API key.
 *
 * Idempotent — safe to re-run. Reads ADMIN_EMAIL / ADMIN_PASSWORD from the
 * environment (see .env.example). Run with: `npm run db:seed`.
 */
import { config } from "dotenv";
import { hash } from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import * as schema from "../src/db/schema";
import { users, programConfig, apiKeys, rewards } from "../src/db/schema";
import { generateApiKey } from "../src/lib/apiKey";

// drizzle-kit-style env loading (tsx does not read .env.local automatically).
config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD (env or .env.local) before seeding.",
    );
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  try {
    // 1. Admin user (upsert on unique email).
    const passwordHash = await hash(password, 10);
    await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: "Admin",
        role: "admin",
        status: "active",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash, role: "admin", status: "active" },
      });
    console.log(`✓ Admin user ready: ${email}`);

    // 2. Singleton program_config row (id = 1) with defaults.
    await db
      .insert(programConfig)
      .values({ id: 1 })
      .onConflictDoNothing({ target: programConfig.id });
    console.log("✓ program_config row ready");

    // 3. Demo API key — only create if none exists, print plaintext once.
    const existing = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeys);
    if ((existing[0]?.count ?? 0) === 0) {
      const { plain, hashedKey } = generateApiKey();
      await db.insert(apiKeys).values({ label: "Demo POS key", hashedKey });
      console.log(`✓ Demo API key created (store it now, shown once):`);
      console.log(`    ${plain}`);
    } else {
      console.log("• API key(s) already exist — skipping demo key");
    }

    // 4. Demo reward — only if the catalog is empty.
    const rewardCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rewards);
    if ((rewardCount[0]?.count ?? 0) === 0) {
      await db.insert(rewards).values({
        name: "Free Coffee",
        description: "Redeem points for a free coffee.",
        pointsCost: 100,
      });
      console.log("✓ Demo reward created (Free Coffee, 100 pts)");
    } else {
      console.log("• Reward(s) already exist — skipping demo reward");
    }

    console.log("\nSeed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
