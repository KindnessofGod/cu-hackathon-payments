import { finishFingerprintSetup, startFingerprintSetup } from "@/lib/domain";
import { baseUrl, body, fail, ok, requireCustomer } from "@/lib/http";

/** Step 1 of setup: the options the device needs to create a fingerprint passkey. */
export async function GET() {
  try {
    return ok({ options: await startFingerprintSetup(await requireCustomer(), await baseUrl()) });
  } catch (e) {
    return fail(e);
  }
}

/** Step 2 of setup: the device's answer, checked and saved. */
export async function POST(req: Request) {
  try {
    const b = await body(req);
    await finishFingerprintSetup(await requireCustomer(), b.response, await baseUrl());
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
