import { requireSeller } from "@/lib/merchantAuth";
import { merchantView } from "@/lib/domain";
import { fail, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireSeller();
    return ok(await merchantView((await params).id, scope.kind === "demo" ? scope.customerId : undefined));
  } catch (e) {
    return fail(e);
  }
}
