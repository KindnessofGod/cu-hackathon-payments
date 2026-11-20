import { fail, ok, requireCustomer } from "@/lib/http";
import { sign } from "@/lib/secret";

/** The stage key for this customer: the studio opens /stage?k=<key> to see and hear the live demo. */
export async function GET() {
  try {
    const c = await requireCustomer();
    return ok({ key: sign(`stage:${c.id}`).slice(0, 24) });
  } catch (e) {
    return fail(e);
  }
}
