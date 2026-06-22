import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Standalone CLI (drizzle-kit) does not auto-load Next.js env files.
config({ path: ".env" });
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
