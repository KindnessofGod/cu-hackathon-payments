import { growSummary, investPractice, saveMoney } from "@/lib/grow";
import { body, fail, ok, requireCustomer } from "@/lib/http";

/** What the customer has saved and invested, and live share prices. */
export async function GET() {
  try {
    return ok(await growSummary(await requireCustomer()));
  } catch (e) {
    return fail(e);
  }
}

/** Starts a savings or practice-investment payment. It still needs the fingerprint (or tap) to be paid. */
export async function POST(req: Request) {
  try {
    const b = await body(req);
    const customer = await requireCustomer();
    const amount = String(b.amount ?? "");
    const r = b.action === "invest" ? await investPractice(customer, String(b.share ?? ""), amount) : await saveMoney(customer, amount);
    return ok({ id: r.id, to: r.merchantName, invest: r.invest });
  } catch (e) {
    return fail(e);
  }
}
