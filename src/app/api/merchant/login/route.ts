import { body, fail, ok } from "@/lib/http";
import { DomainError } from "@/lib/domain";
import { MERCHANT_COOKIE, merchantLogin, sellerScope } from "@/lib/merchantAuth";

export async function GET() {
  return ok({ merchant: Boolean(await sellerScope()) });
}

export async function POST(req: Request) {
  try {
    const b = await body(req);
    const value = merchantLogin(String(b.key ?? "").slice(0, 200));
    if (!value) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      throw new DomainError("not_allowed", "That merchant key is not right.");
    }
    const res = ok({ merchant: true });
    res.cookies.set(MERCHANT_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  const res = ok({ merchant: false });
  res.cookies.delete(MERCHANT_COOKIE);
  return res;
}
