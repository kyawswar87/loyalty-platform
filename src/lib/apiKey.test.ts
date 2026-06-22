import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/apiKey";

describe("hashApiKey", () => {
  it("is deterministic for the same input", () => {
    expect(hashApiKey("lk_secret")).toBe(hashApiKey("lk_secret"));
  });

  it("differs for different inputs", () => {
    expect(hashApiKey("lk_a")).not.toBe(hashApiKey("lk_b"));
  });

  it("produces a SHA-256 hex digest", () => {
    const plain = "lk_example";
    const expected = createHash("sha256").update(plain).digest("hex");
    expect(hashApiKey(plain)).toBe(expected);
    expect(hashApiKey(plain)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateApiKey", () => {
  it("returns a plaintext key with the lk_ prefix", () => {
    expect(generateApiKey().plain.startsWith("lk_")).toBe(true);
  });

  it("returns a hashedKey that matches hashApiKey(plain)", () => {
    const { plain, hashedKey } = generateApiKey();
    expect(hashedKey).toBe(hashApiKey(plain));
  });

  it("produces a unique key on each call", () => {
    expect(generateApiKey().plain).not.toBe(generateApiKey().plain);
  });
});
