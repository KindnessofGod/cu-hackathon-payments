import { startDemo, demoSellerCookie, DEMO_SELLER_COOKIE } from "@/lib/demo";
import { baseUrl, DEVICE_COOKIE, fail, ok } from "@/lib/http";
import { publicCustomer } from "@/lib/domain";

/** Starts the one-device demo: a simulated customer (limit already set) and a simulated seller for this browser. */
export async function POST() {
  try {
    const { customer, deviceToken } = await startDemo(await baseUrl());
    const res = ok({ customer: publicCustomer(customer) });
    const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 };
    res.cookies.set(DEVICE_COOKIE, deviceToken, opts);
    res.cookies.set(DEMO_SELLER_COOKIE, demoSellerCookie(customer.id), opts);
    return res;
  } catch (e) {
    return fail(e);
  }
}

/** Ends the demo on this browser (the simulated records stay, harmlessly). */
export async function DELETE() {
  const res = ok({ ok: true });
  res.cookies.delete(DEVICE_COOKIE);
  res.cookies.delete(DEMO_SELLER_COOKIE);
  return res;
}
