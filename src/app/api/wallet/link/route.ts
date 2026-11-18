import { finishLink, publicCustomer, startLink } from "@/lib/domain";
import { body, DEVICE_COOKIE, fail, ok, requireCustomer } from "@/lib/http";

/** On a device that is set up: get a one-time six-digit code. */
export async function POST() {
  try {
    return ok(await startLink(await requireCustomer()));
  } catch (e) {
    return fail(e);
  }
}

/** On the new device (for example the Home Screen app): enter the code to sign in as the same customer. */
export async function PUT(req: Request) {
  try {
    const b = await body(req);
    const { customer, deviceToken } = await finishLink(String(b.code ?? ""));
    const res = ok({ customer: publicCustomer(customer) });
    res.cookies.set(DEVICE_COOKIE, deviceToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
    return res;
  } catch (e) {
    return fail(e);
  }
}
