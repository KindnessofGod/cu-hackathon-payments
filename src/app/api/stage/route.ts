import { DomainError } from "@/lib/domain";
import { fail, ok } from "@/lib/http";
import { stageChannel } from "@/lib/merchantAuth";

/** The studio channel's secret name, for the customer's device or a device holding the merchant key. */
export async function GET(req: Request) {
  try {
    const channel = await stageChannel(new URL(req.url).searchParams.get("key"));
    if (!channel) throw new DomainError("not_allowed", "Enter the merchant key to open the studio screen.");
    return ok({ channel });
  } catch (e) {
    return fail(e);
  }
}
