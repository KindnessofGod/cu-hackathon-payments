import { sendToContact } from "@/lib/domain";
import { body, fail, ok, requireCustomer } from "@/lib/http";

/** Starts a payment the customer asked for by voice. It still needs the fingerprint (or tap) to be paid. */
export async function POST(req: Request) {
  try {
    const b = await body(req);
    const amount = b.currency === "USD" ? `${String(b.amount ?? "")} dollars` : String(b.amount ?? "");
    const r = await sendToContact(await requireCustomer(), String(b.to ?? ""), amount);
    return ok({ id: r.id, to: r.merchantName, naira: r.saidNaira ?? "" });
  } catch (e) {
    return fail(e);
  }
}
