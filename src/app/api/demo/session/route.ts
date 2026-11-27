import { currentCustomer, fail, ok, voiceJar } from "@/lib/http";
import { voiceStatus } from "@/lib/voice/entitlement";
import { isMockWallet } from "@/lib/op";

/** Is a demo running on this browser, and what voice does it have? Uses no voice allowance. */
export async function GET() {
  try {
    const c = await currentCustomer();
    const demo = Boolean(c && c.demo && isMockWallet(c.wallet.id));
    const voice = await voiceStatus(demo ? c : null, await voiceJar());
    return ok({ demo, voice });
  } catch (e) {
    return fail(e);
  }
}
