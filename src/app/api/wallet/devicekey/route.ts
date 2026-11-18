import { finishDeviceKeySetup, startDeviceKeySetup } from "@/lib/domain";
import { body, fail, ok, requireCustomer } from "@/lib/http";

/** Native app fingerprint setup, step 1. */
export async function GET() {
  try {
    return ok({ challenge: await startDeviceKeySetup(await requireCustomer()) });
  } catch (e) {
    return fail(e);
  }
}

/** Step 2: the app's public key and its signature over the challenge. */
export async function POST(req: Request) {
  try {
    const b = await body(req);
    await finishDeviceKeySetup(await requireCustomer(), b.publicKey, b.signature);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
