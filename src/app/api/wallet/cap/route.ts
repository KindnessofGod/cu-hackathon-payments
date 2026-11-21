import { startCap } from "@/lib/domain";
import { baseUrl, body, fail, ok, requireCustomer } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const b = await body(req);
    const { redirectUrl, limit } = await startCap(await requireCustomer(), String(b.amount ?? ""), b.every === "day" ? "day" : "week", await baseUrl());
    return ok({ redirectUrl, limit });
  } catch (e) {
    return fail(e);
  }
}
