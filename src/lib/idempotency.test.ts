import { describe, expect, it } from "vitest";
import { idempotencyKeyOf, isUniqueViolation } from "@/lib/idempotency";

describe("idempotencyKeyOf", () => {
  const withKey = (v?: string) =>
    new Request("http://x", v ? { headers: { "Idempotency-Key": v } } : {});

  it("returns the trimmed header value", () => {
    expect(idempotencyKeyOf(withKey("  order-1  "))).toBe("order-1");
  });

  it("returns null when missing or blank", () => {
    expect(idempotencyKeyOf(withKey())).toBeNull();
    expect(idempotencyKeyOf(withKey("   "))).toBeNull();
  });
});

describe("isUniqueViolation", () => {
  it("detects Postgres 23505 on the error or its cause", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("is false for other errors", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("nope"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
