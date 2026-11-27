import { requireSeller } from "@/lib/merchantAuth";
import { merchantHistory, merchantInfo, recentCustomers } from "@/lib/domain";
import { fail, ok } from "@/lib/http";
import { isSimulated } from "@/lib/op";
import { getStore } from "@/lib/store";
import type { Customer } from "@/lib/domain";

export async function GET() {
  try {
    const scope = await requireSeller();
    if (scope.kind === "demo") {
      // A judge's simulated seller sees only their own demo customer.
      const c = await getStore().get<Customer>("customers", scope.customerId);
      return ok({
        simulated: true,
        demo: true,
        merchant: await merchantInfo(true),
        recentCustomers: c ? [{ payCode: c.payCode, name: c.wallet.publicName ?? "Demo customer", lastRequestAt: new Date().toISOString() }] : [],
        history: await merchantHistory(scope.customerId),
      });
    }
    return ok({ simulated: isSimulated(), merchant: await merchantInfo(), recentCustomers: await recentCustomers(), history: await merchantHistory() });
  } catch (e) {
    return fail(e);
  }
}
