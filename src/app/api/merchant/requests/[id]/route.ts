import { merchantView } from "@/lib/domain";
import { fail, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok(await merchantView((await params).id));
  } catch (e) {
    return fail(e);
  }
}
