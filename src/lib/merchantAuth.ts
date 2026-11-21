import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { currentCustomer } from "./http";
import { DomainError } from "./domain";
import { isSimulated } from "./op";
import { sha256, sign } from "./secret";

// The merchant side (asking for payments, seeing recent customers) and the studio screen are locked with
// one key, MERCHANT_KEY, set on the server. A device enters it once and keeps a signed cookie. Without
// this, anyone who found the site could see customers' pay codes and send them requests during a demo.

export const MERCHANT_COOKIE = "cw_merchant";

function configuredKey(): string | null {
  const k = process.env.MERCHANT_KEY?.trim();
  return k && k.length >= 8 ? k : null;
}

/** The cookie value for the current key; changing the key signs every device out. */
function pass(key: string): string {
  return sign(`merchant:${sha256(key)}`);
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checks a typed key; returns the cookie value to set, or null. */
export function merchantLogin(typed: string): string | null {
  const key = configuredKey();
  if (!key || !same(typed.trim(), key)) return null;
  return pass(key);
}

export async function isMerchant(): Promise<boolean> {
  const key = configuredKey();
  if (!key) return isSimulated(); // simulated mode without a key stays open; live mode fails closed
  const got = (await cookies()).get(MERCHANT_COOKIE)?.value;
  return Boolean(got && same(got, pass(key)));
}

export async function requireMerchant(): Promise<void> {
  if (!(await isMerchant())) throw new DomainError("not_allowed", "Enter the merchant key to use this page.");
}

/** The studio channel's name: secret, so only the customer's device and key holders can send or listen. */
export async function stageChannel(): Promise<string | null> {
  if (!(await isMerchant()) && !(await currentCustomer())) return null;
  return `live-${sign(`stage:${configuredKey() ?? "sim"}`).slice(0, 24)}`;
}
