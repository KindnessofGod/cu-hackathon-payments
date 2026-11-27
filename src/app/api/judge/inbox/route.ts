import { listJudgeRequests } from "@/lib/judge";
import { fail, ok } from "@/lib/http";
import { requireMerchant } from "@/lib/merchantAuth";

/** The owner's list of judge requests (merchant key). */
export async function GET() {
  try {
    await requireMerchant();
    const list = await listJudgeRequests();
    return ok({ requests: list.map(({ id, name, email, competition, createdAt, status, expiresAt, usage }) => ({ id, name, email, competition, createdAt, status, expiresAt, usage })) });
  } catch (e) {
    return fail(e);
  }
}
