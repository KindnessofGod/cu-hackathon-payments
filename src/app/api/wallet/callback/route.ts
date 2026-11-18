import { NextResponse } from "next/server";
import { handleCallback } from "@/lib/domain";
import { baseUrl, currentCustomer } from "@/lib/http";

/** The wallet's consent page redirects the browser here with interact_ref and hash. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  let outcome = "failed";
  let message: string | undefined;
  try {
    const r = await handleCallback(await currentCustomer(), q.get("session") ?? "", {
      interactRef: q.get("interact_ref") ?? undefined,
      hash: q.get("hash") ?? undefined,
      result: q.get("result") ?? undefined,
    });
    outcome = r.outcome;
    message = r.message;
  } catch (e) {
    message = e instanceof Error ? e.message : "Something went wrong.";
  }
  const to = new URL(`${await baseUrl()}/wallet`);
  to.searchParams.set("outcome", outcome);
  if (message) to.searchParams.set("message", message);
  return NextResponse.redirect(to, 303);
}
