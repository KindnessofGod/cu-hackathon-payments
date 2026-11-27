import { alertOwner } from "@/lib/alert";
import { createJudgeRequest, decisionSig } from "@/lib/judge";
import { baseUrl, body, fail, ok } from "@/lib/http";

/** A judge asks for access. The owner is alerted with a one-tap review link. */
export async function POST(req: Request) {
  try {
    const b = await body(req);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const { id, pollToken, request } = await createJudgeRequest({
      name: String(b.name ?? ""),
      email: String(b.email ?? ""),
      competition: String(b.competition ?? ""),
      website: String(b.website ?? ""),
      ip,
    });
    const link = `${await baseUrl()}/judge/approve?id=${encodeURIComponent(id)}&sig=${encodeURIComponent(decisionSig(id))}`;
    const alerted = await alertOwner({
      title: "Pay Alone: judge access request",
      line: `${request.name} (${request.competition}) wants to try Pay Alone. Tap to review.`,
      details: `${request.name} <${request.email}> for ${request.competition} asks to try Pay Alone with live voice.`,
      link,
    });
    return ok({ id, pollToken, alerted: alerted.ntfy || alerted.email });
  } catch (e) {
    return fail(e);
  }
}
