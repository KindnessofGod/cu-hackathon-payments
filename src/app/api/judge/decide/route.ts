import { decideJudge, decisionSig } from "@/lib/judge";
import { body, fail, ok } from "@/lib/http";
import { isMerchant } from "@/lib/merchantAuth";

/** Approve or deny a judge. Needs the link's signature, or the merchant key (the owner's inbox). */
export async function POST(req: Request) {
  try {
    const b = await body(req);
    const id = String(b.id ?? "");
    const sig = b.sig ? String(b.sig) : (await isMerchant()) ? decisionSig(id) : "";
    const r = await decideJudge(id, sig, b.decision === "approve" ? "approve" : "deny");
    return ok({ status: r.status, expiresAt: r.expiresAt });
  } catch (e) {
    return fail(e);
  }
}
