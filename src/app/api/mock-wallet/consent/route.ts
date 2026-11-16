import { DomainError } from "@/lib/domain";
import { body, fail, ok } from "@/lib/http";
import { isSimulated } from "@/lib/op";
import { decideMockConsent, getMockGrant } from "@/lib/op/mock";

// SIMULATED consent. Only exists while MOCK_OP=1. The real consent page belongs to the wallet provider.
export async function GET(req: Request) {
  try {
    if (!isSimulated()) throw new DomainError("not_found", "Not available.");
    const g = await getMockGrant(new URL(req.url).searchParams.get("grant") ?? "");
    if (!g || g.status !== "pending") throw new DomainError("not_found", "This simulated consent request is no longer open.");
    return ok({ walletAddress: g.walletId, limits: g.limits });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    if (!isSimulated()) throw new DomainError("not_found", "Not available.");
    const b = await body(req);
    return ok({ redirectUrl: await decideMockConsent(String(b.grant ?? ""), b.approve === true) });
  } catch (e) {
    return fail(e);
  }
}
