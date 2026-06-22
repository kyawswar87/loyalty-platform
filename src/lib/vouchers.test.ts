import { describe, expect, it } from "vitest";
import {
  generateReferralCode,
  generateVoucherCode,
  randomCode,
} from "@/lib/vouchers";

const UNAMBIGUOUS = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;

describe("randomCode", () => {
  it("returns a code of the requested length over the unambiguous alphabet", () => {
    const code = randomCode(8);
    expect(code).toHaveLength(8);
    expect(code).toMatch(UNAMBIGUOUS);
  });

  it("excludes ambiguous characters (0, O, 1, I, L)", () => {
    const joined = Array.from({ length: 50 }, () => randomCode(8)).join("");
    expect(joined).not.toMatch(/[01OIL]/);
  });
});

describe("generateVoucherCode", () => {
  it("is prefixed with V- and is unique across calls", () => {
    const a = generateVoucherCode();
    expect(a).toMatch(/^V-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(a).not.toBe(generateVoucherCode());
  });
});

describe("generateReferralCode", () => {
  it("is prefixed with R-", () => {
    expect(generateReferralCode()).toMatch(
      /^R-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/,
    );
  });
});
