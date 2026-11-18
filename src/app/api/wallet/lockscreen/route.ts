import { baseUrl, fail, ok, requireCustomer } from "@/lib/http";
import { sign } from "@/lib/secret";

/** The private link to this customer's lock-screen picture (for the "Set as lock screen" Shortcut). */
export async function GET() {
  try {
    const c = await requireCustomer();
    const sig = sign(`lockscreen:${c.id}:${c.payCode}`).slice(0, 32);
    return ok({ url: `${await baseUrl()}/api/lockscreen/${c.id}/${sig}` });
  } catch (e) {
    return fail(e);
  }
}
