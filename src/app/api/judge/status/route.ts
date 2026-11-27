import { judgeCookie, judgeStatus } from "@/lib/judge";
import { body, fail, ok } from "@/lib/http";

/** The judge's browser asks "am I approved yet?". When approved it receives its voice cookie. */
export async function POST(req: Request) {
  try {
    const b = await body(req);
    const id = String(b.id ?? "");
    const s = await judgeStatus(id, String(b.token ?? ""));
    const res = ok({ status: s.status, expiresAt: s.expiresAt, usage: s.usage, limits: s.limits });
    if (s.status === "approved" && s.expiresAt && Date.parse(s.expiresAt) > Date.now()) {
      res.cookies.set("cw_judge", judgeCookie(id), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: new Date(s.expiresAt),
      });
    }
    return res;
  } catch (e) {
    return fail(e);
  }
}
