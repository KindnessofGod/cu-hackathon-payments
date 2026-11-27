// The one-device judge demo. A visitor gets a SIMULATED customer (play money, no real wallet, no setup wall)
// with a spending limit already set, plus a seller on the same device. Everything runs on the simulated
// wallet, so no real money and no real wallet can be touched. The AI still never moves money: the customer
// approves each payment (a tap, or a fingerprint if they set one up), exactly as in the real app.
import { randomBytes, timingSafeEqual } from "crypto";
import { DomainError, handleCallback, setupCustomer, startCap, type Customer } from "./domain";
import { decideMockConsent, MOCK_HOST } from "./op/mock";
import { sign } from "./secret";
import { getStore } from "./store";

export const DEMO_SELLER_COOKIE = "cw_demo_seller";
export const DEMO_LIMIT_NAIRA = "50000";

/** Creates the simulated customer and sets the weekly limit, so the judge can pay straight away. */
export async function startDemo(baseUrl: string): Promise<{ customer: Customer; deviceToken: string }> {
  const walletUrl = `${MOCK_HOST}/demo-${randomBytes(4).toString("hex")}`;
  const { customer, deviceToken } = await setupCustomer(walletUrl);
  customer.demo = true;
  customer.wallet = { ...customer.wallet, publicName: "Demo customer" };
  await getStore().put("customers", customer.id, customer);

  // Set the limit through the same code path the real app uses, approving on the simulated consent step.
  const { redirectUrl } = await startCap(customer, DEMO_LIMIT_NAIRA, "week", baseUrl);
  const grant = new URL(redirectUrl, baseUrl).searchParams.get("grant") ?? "";
  const back = new URL(await decideMockConsent(grant, true));
  const outcome = await handleCallback(customer, back.searchParams.get("session") ?? "", {
    interactRef: back.searchParams.get("interact_ref") ?? undefined,
    hash: back.searchParams.get("hash") ?? undefined,
  });
  if (outcome.outcome !== "cap_set") throw new DomainError("wrong_state", outcome.message ?? "The demo could not set its limit.");
  return { customer, deviceToken };
}

function mac(customerId: string): string {
  return sign(`demo-seller:${customerId}`).slice(0, 32);
}

/** The cookie that lets this browser act as the simulated seller for ONE demo customer and nobody else. */
export function demoSellerCookie(customerId: string): string {
  return `${customerId}.${mac(customerId)}`;
}

/** The demo customer's id if the cookie is genuine and that customer is a demo customer. */
export async function demoSellerFromCookie(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [id, tag] = value.split(".");
  if (!id || !tag) return null;
  const want = Buffer.from(mac(id));
  const got = Buffer.from(tag);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const c = await getStore().get<Customer>("customers", id);
  return c?.demo ? c.id : null;
}
