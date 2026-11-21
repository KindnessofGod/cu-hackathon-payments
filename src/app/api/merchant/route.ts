import { requireMerchant } from "@/lib/merchantAuth";
import { merchantHistory, merchantInfo, recentCustomers } from "@/lib/domain";
import { fail, ok } from "@/lib/http";
import { isSimulated } from "@/lib/op";

export async function GET() {
  try {
    await requireMerchant();
    return ok({ simulated: isSimulated(), merchant: await merchantInfo(), recentCustomers: await recentCustomers(), history: await merchantHistory() });
  } catch (e) {
    return fail(e);
  }
}
