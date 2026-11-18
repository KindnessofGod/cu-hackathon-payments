import { declineRequest, publicRequest } from "@/lib/domain";
import { fail, ok, requireCustomer } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const customer = await requireCustomer();
    return ok({ request: publicRequest(await declineRequest(customer, (await params).id), customer) });
  } catch (e) {
    return fail(e);
  }
}
