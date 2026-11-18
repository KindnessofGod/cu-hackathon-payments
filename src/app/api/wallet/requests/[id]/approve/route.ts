import { approveRequest, publicRequest } from "@/lib/domain";
import { baseUrl, body, fail, ok, requireCustomer } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const customer = await requireCustomer();
    const b = await body(req);
    const { request, redirectUrl } = await approveRequest(customer, (await params).id, b.proof, await baseUrl());
    return ok({ request: publicRequest(request, customer), redirectUrl });
  } catch (e) {
    return fail(e);
  }
}
