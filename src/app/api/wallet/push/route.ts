import { DomainError } from "@/lib/domain";
import { body, currentCustomer, fail, ok, requireCustomer } from "@/lib/http";
import { alertCustomer, isSubscription, pushCount, pushPublicKey, removePush, savePush } from "@/lib/push";

/** The public key the browser needs to subscribe, and how many of this customer's devices get alerts. */
export async function GET() {
  try {
    const customer = await currentCustomer();
    return ok({ publicKey: pushPublicKey(), devices: customer ? await pushCount(customer.id) : 0 });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const customer = await requireCustomer();
    const b = await body(req);
    if (!isSubscription(b.subscription)) throw new DomainError("bad_input", "This device did not give a valid alert address.");
    await savePush(customer.id, b.subscription);
    return ok({ ok: true, devices: await pushCount(customer.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const customer = await requireCustomer();
    const b = await body(req);
    if (typeof b.endpoint === "string") await removePush(customer.id, b.endpoint);
    return ok({ ok: true, devices: await pushCount(customer.id) });
  } catch (e) {
    return fail(e);
  }
}

/** A test alert, sent after a short wait so there is time to lock the iPad. */
export async function PUT(req: Request) {
  try {
    const customer = await requireCustomer();
    const b = await body(req);
    const wait = Math.min(Math.max(Number(b.delaySeconds) || 0, 0), 20);
    if (wait) await new Promise((r) => setTimeout(r, wait * 1000));
    const r = await alertCustomer(customer.id, {
      title: "Test alert",
      body: "This is a test from Pay Alone. When a seller asks you for money, you will hear an alert like this one.",
      url: "/wallet",
      tag: "test",
    });
    return ok(r);
  } catch (e) {
    return fail(e);
  }
}
