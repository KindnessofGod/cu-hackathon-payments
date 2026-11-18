import { publicCustomer, setupCustomer } from "@/lib/domain";
import { body, DEVICE_COOKIE, fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const b = await body(req);
    const { customer, deviceToken } = await setupCustomer(String(b.walletAddress ?? ""));
    const res = ok({ customer: publicCustomer(customer) });
    res.cookies.set(DEVICE_COOKIE, deviceToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  const res = ok({ ok: true });
  res.cookies.delete(DEVICE_COOKIE);
  return res;
}
