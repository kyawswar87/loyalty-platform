import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 1000, 0).ok).toBe(true);
    }
  });

  it("blocks once the limit is exceeded, with a retryAfter", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000, 0);
    const blocked = rateLimit("k", 3, 1000, 500);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfter).toBe(1); // 500ms left → ceil = 1s
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000, 0);
    expect(rateLimit("k", 3, 1000, 1000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1000, 0);
    expect(rateLimit("a", 3, 1000, 0).ok).toBe(false);
    expect(rateLimit("b", 3, 1000, 0).ok).toBe(true);
  });
});
