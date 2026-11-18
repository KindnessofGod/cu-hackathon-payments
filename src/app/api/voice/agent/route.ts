import { capSummary, getRequestFor, isOpen } from "@/lib/domain";
import { fail, requireCustomer } from "@/lib/http";
import { exceedsCap, remainingOfCap, speakAmount } from "@/lib/money";
import { askingSentence, isLang, type Lang } from "@/lib/voice/sentences";

/**
 * Starts a live voice conversation (ElevenLabs Agents) about one waiting request.
 * Returns a one-time conversation token and the facts the agent may use. Every name and amount
 * comes from our records and the wallet's quote; the agent is told to use only these. The agent
 * cannot move money: its only tools open the fingerprint prompt or refuse, both in the browser.
 */
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || "agent_3901m7nzvq1teyj9pm23e4gfqtmz";

// Languages the ElevenLabs agent accepts. Igbo is not one of them (checked 18 Nov), and Pidgin has no
// code of its own; both run in English, with the agent told which language the customer chose.
const AGENT_LANG: Record<Lang, string> = { en: "en", pcm: "en", yo: "yo", ig: "en", ha: "ha" };
const NAMES: Record<Lang, string> = { en: "English", pcm: "Nigerian Pidgin", yo: "Yoruba", ig: "English (the customer chose Igbo, which this voice cannot speak yet)", ha: "Hausa" };

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const lang: Lang = isLang(q.get("lang")) ? (q.get("lang") as Lang) : "en";
    const native = q.get("native") === "1";
    const customer = await requireCustomer();
    const r = await getRequestFor(customer, q.get("id") ?? "");
    if (!isOpen(r) || !r.quote) return Response.json({ error: { kind: "not_ready", message: "This request is not waiting for an answer." } }, { status: 409 });
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return Response.json({ error: { kind: "unavailable", message: "Live voice is not set up." } }, { status: 503 });

    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`, {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("agent token failed:", res.status, (await res.text()).slice(0, 200));
      return Response.json({ error: { kind: "unavailable", message: "Live voice is not available right now." } }, { status: 502 });
    }
    const { token } = (await res.json()) as { token: string };

    const { receiveAmount, debitAmount } = r.quote;
    const cap = capSummary(customer.cap);
    const active = cap && cap.status === "active" ? cap : null;
    const over = Boolean(active && exceedsCap(active.limit, active.spent, debitAmount));
    const hasDevice = Boolean(customer.deviceKeys?.length);
    const hasPasskey = Boolean(customer.passkeys?.length);
    const approveHow =
      native && hasDevice
        ? "Rest your finger on the Home button."
        : hasPasskey
          ? "Tap the screen once, then rest your finger on the Home button."
          : hasDevice
            ? "Open the Pay Alone app on this iPad to approve with your fingerprint."
            : "Tap the screen once to pay.";
    const known = Boolean(customer.contacts[r.merchantWalletId]);
    const firstLang: Lang = AGENT_LANG[lang] === "en" && lang !== "pcm" ? "en" : lang;

    return Response.json(
      {
        token,
        language: AGENT_LANG[lang],
        dynamicVariables: {
          first_message: `${askingSentence(firstLang, { name: r.merchantName, known, receive: receiveAmount, debit: debitAmount })}`,
          language_name: NAMES[lang],
          merchant_name: r.merchantName,
          amount: speakAmount(receiveAmount),
          debit: speakAmount(debitAmount),
          times_paid: String(customer.contacts[r.merchantWalletId]?.paidCount ?? 0),
          limit_text: active ? `${speakAmount(active.limit)} each ${active.every}` : "no limit is set, so the wallet will open its own page to confirm this one payment",
          left_text: active ? speakAmount(active.left) : "not known, no limit is set",
          left_after_text: active ? (over ? "the payment is over the limit, so the wallet will refuse it" : speakAmount(remainingOfCap(active.left, debitAmount))) : "not known",
          over_limit: over ? "yes" : "no",
          approve_how: approveHow,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
