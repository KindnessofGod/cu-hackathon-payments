import { capSummary, getRequestFor } from "@/lib/domain";
import { fail, requireCustomer } from "@/lib/http";
import { synthesize } from "@/lib/voice/providers";
import { answerSentence, askingSentence, isLang, leftSentence, resultSentence } from "@/lib/voice/sentences";

/**
 * Speaks one of our own sentences in the chosen language. The browser names WHICH sentence
 * (what=asking|result|left, plus the request id); the words and amounts come from our records.
 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const lang = isLang(q.get("lang")) ? (q.get("lang") as Parameters<typeof askingSentence>[0]) : "en";
    const customer = await requireCustomer();
    let text: string;
    const what = q.get("what");
    if (what === "left") {
      const cap = capSummary(customer.cap);
      if (!cap || cap.status !== "active") return new Response(null, { status: 404 });
      text = leftSentence(lang, cap.left, cap.limit);
    } else {
      const r = await getRequestFor(customer, q.get("id") ?? "");
      if (what === "asking") {
        if (!r.quote) return new Response(null, { status: 409 });
        text = askingSentence(lang, { name: r.merchantName, known: Boolean(customer.contacts[r.merchantWalletId]), receive: r.quote.receiveAmount, debit: r.quote.debitAmount });
        if (q.get("answer") === "1") text += ` ${answerSentence(lang)}`;
      } else if (what === "result") {
        text = resultSentence(lang, { paid: r.status === "paid", name: r.merchantName, debit: r.paid?.debitAmount });
      } else {
        return new Response(null, { status: 400 });
      }
    }
    const { audio, provider } = await synthesize(text, lang);
    return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-voice-provider": provider } });
  } catch (e) {
    if (e instanceof Error && /elevenlabs|spitch|not available|no key/.test(e.message)) {
      console.error("voice failed:", e.message);
      return new Response(null, { status: 502 });
    }
    return fail(e);
  }
}
