import { requireSeller } from "@/lib/merchantAuth";
import { createRequest, DomainError } from "@/lib/domain";
import type { Customer } from "@/lib/domain";
import { body, fail, ok } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const scope = await requireSeller();
    const b = await body(req);
    let payCode = String(b.payCode ?? "");
    if (scope.kind === "demo") {
      // The simulated seller can only ask the demo customer on this device.
      const c = await getStore().get<Customer>("customers", scope.customerId);
      if (!c) throw new DomainError("not_found", "The demo has ended. Start it again.");
      if (payCode.replace(/\D/g, "") !== c.payCode) throw new DomainError("bad_input", `In the demo, ask the demo customer: pay code ${c.payCode}.`);
      payCode = c.payCode;
    }
    const r = await createRequest(payCode, String(b.amount ?? ""), b.currency === "NGN" ? "NGN" : undefined);
    return ok({ id: r.id });
  } catch (e) {
    return fail(e);
  }
}
