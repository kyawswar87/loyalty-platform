import { describe, expect, it } from "vitest";
import { pointsForAmount } from "@/lib/points";

describe("pointsForAmount", () => {
  it("multiplies amount by the earn rate", () => {
    expect(pointsForAmount(100, 1)).toBe(100);
    expect(pointsForAmount(50, 2)).toBe(100);
  });

  it("floors fractional results (never over-credits)", () => {
    expect(pointsForAmount(10.5, 1)).toBe(10);
    expect(pointsForAmount(99, 0.1)).toBe(9); // 9.9 → 9
    expect(pointsForAmount(3, 1.5)).toBe(4); // 4.5 → 4
  });

  it("returns 0 for a zero rate or zero amount", () => {
    expect(pointsForAmount(100, 0)).toBe(0);
    expect(pointsForAmount(0, 5)).toBe(0);
  });
});
