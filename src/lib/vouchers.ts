import { randomBytes } from "node:crypto";

// Crockford-ish alphabet: no 0/O/1/I/L to keep codes easy to read aloud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Random fixed-length code over the unambiguous alphabet. */
export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Voucher code issued on redemption, e.g. `V-7H3KQ9MA`. Unique in `redemptions`. */
export function generateVoucherCode(): string {
  return `V-${randomCode(8)}`;
}

/** Per-customer referral code, e.g. `R-9KMA7H3Q`. Unique in `customers`. */
export function generateReferralCode(): string {
  return `R-${randomCode(8)}`;
}
