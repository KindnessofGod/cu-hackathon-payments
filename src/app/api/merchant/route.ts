import { merchantInfo, recentCustomers } from "@/lib/domain";
import { fail, ok } from "@/lib/http";
import { isSimulated } from "@/lib/op";

export async function GET() {
  try {
    return ok({ simulated: isSimulated(), merchant: await merchantInfo(), recentCustomers: await recentCustomers() });
  } catch (e) {
    return fail(e);
  }
}
