import { stopEverything } from "@/lib/domain";
import { fail, ok, requireCustomer } from "@/lib/http";

export async function POST() {
  try {
    await stopEverything(await requireCustomer());
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
