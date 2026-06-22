import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type DB = NodePgDatabase<typeof schema>;

/** The transaction handle passed to `db.transaction(async (tx) => ...)`. */
export type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

let client: DB | undefined;

function connect(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Start Postgres with `docker compose up -d` and copy .env.example to .env.local.",
    );
  }
  // A module-scoped pool is reused across hot reloads / serverless invocations.
  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

/**
 * Drizzle client over node-postgres (`pg`).
 *
 * Lazily connects on first property access so importing this module (e.g.
 * during `next build`) never requires `DATABASE_URL` to be present.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    client ??= connect();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
