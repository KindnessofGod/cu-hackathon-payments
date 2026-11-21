import { requireMerchant } from "@/lib/merchantAuth";
import { createRequest } from "@/lib/domain";
import { body, fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  try {
    await requireMerchant();
    const b = await body(req);
    const r = await createRequest(String(b.payCode ?? ""), String(b.amount ?? ""));
    return ok({ id: r.id });
  } catch (e) {
    return fail(e);
  }
}
