import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/db/schema";

/** Public prefix so leaked keys are recognizable; the secret follows. */
const KEY_PREFIX = "lk_";

/**
 * Hash an API key for storage / lookup.
 *
 * Uses SHA-256 (not bcrypt) on purpose: we need a deterministic value we can
 * look up by equality. The key itself is high-entropy (32 random bytes), so a
 * fast hash is fine — there's nothing to brute-force.
 */
export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/** Generate a new API key: returns the plaintext (show once) and its hash. */
export function generateApiKey(): { plain: string; hashedKey: string } {
  const plain = KEY_PREFIX + randomBytes(32).toString("base64url");
  return { plain, hashedKey: hashApiKey(plain) };
}

export type ApiKeyRow = typeof apiKeys.$inferSelect;

export type ApiKeyAuthResult =
  | { ok: true; apiKey: ApiKeyRow }
  | { ok: false };

/**
 * Authenticate an `/api/v1/*` request via `Authorization: Bearer <key>`.
 *
 * Returns a discriminated result rather than throwing, so handlers can turn a
 * failure into `jsonError("unauthorized", ...)` themselves. On success the
 * matched key's `last_used_at` is touched best-effort.
 */
export async function requireApiKey(req: Request): Promise<ApiKeyAuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return { ok: false };

  const hashedKey = hashApiKey(match[1].trim());
  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.hashedKey, hashedKey),
  });

  if (!apiKey || !apiKey.active) return { ok: false };

  // Best-effort usage stamp; never block auth on this.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id))
    .catch(() => {});

  return { ok: true, apiKey };
}
