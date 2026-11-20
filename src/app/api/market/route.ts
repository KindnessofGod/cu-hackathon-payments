import { market } from "@/lib/grow";
import { fail, ok } from "@/lib/http";

/** Live (delayed) share prices for the practice-investing watch list. Public market data, no customer data. */
export async function GET() {
  try {
    return ok({ source: "Yahoo Finance chart data, delayed", quotes: await market() });
  } catch (e) {
    return fail(e);
  }
}
