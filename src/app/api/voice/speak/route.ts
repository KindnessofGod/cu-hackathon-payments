import { capSummary, getRequestFor } from "@/lib/domain";
import { fail, requireCustomer } from "@/lib/http";
import { synthesize } from "@/lib/voice/providers";
import { exceedsCap, remainingOfCap } from "@/lib/money";
import { answerSentence, askingSentence, howtoSentence, isLang, leftSentence, paidWithLeftSentence, replySentence, resultSentence, type HowTo, type ReplyKind } from "@/lib/voice/sentences";

const REPLIES: ReplyKind[] = ["who", "left", "help", "unclear"];

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
    if (what === "howto") {
      const how = q.get("how") as HowTo;
      if (how !== "finger" && how !== "tapFinger" && how !== "tap") return new Response(null, { status: 400 });
      text = howtoSentence(lang, how);
    } else if (what === "left") {
      const cap = capSummary(customer.cap);
      if (!cap || cap.status !== "active") return new Response(null, { status: 404 });
      text = leftSentence(lang, cap.left, cap.limit);
    } else {
      const r = await getRequestFor(customer, q.get("id") ?? "");
      if (what === "asking") {
        if (!r.quote) return new Response(null, { status: 409 });
        text = askingSentence(lang, { name: r.merchantName, known: Boolean(customer.contacts[r.merchantWalletId]), receive: r.quote.receiveAmount, debit: r.quote.debitAmount });
        if (q.get("answer") === "1") text += ` ${answerSentence(lang)}`;
      } else if (what === "reply") {
        // An answer to the customer's question while the request is waiting. Built from our records only.
        const kind = q.get("kind") as ReplyKind;
        if (!REPLIES.includes(kind)) return new Response(null, { status: 400 });
        const cap = capSummary(customer.cap);
        const active = cap && cap.status === "active" ? cap : null;
        const debit = r.quote?.debitAmount;
        text = replySentence(lang, kind, {
          name: r.merchantName,
          timesPaid: customer.contacts[r.merchantWalletId]?.paidCount ?? 0,
          left: active?.left,
          limit: active?.limit,
          over: Boolean(active && debit && exceedsCap(active.limit, active.spent, debit)),
          leftAfter: active && debit && !exceedsCap(active.limit, active.spent, debit) ? remainingOfCap(active.left, debit) : undefined,
        });
      } else if (what === "result") {
        const cap = capSummary(customer.cap);
        text =
          r.status === "paid" && r.paid
            ? paidWithLeftSentence(lang, { name: r.merchantName, debit: r.paid.debitAmount, ...(cap && cap.status === "active" ? { left: cap.left, limit: cap.limit } : {}) })
            : resultSentence(lang, { paid: false, name: r.merchantName });
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
