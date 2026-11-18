import { capSummary, customerHistory } from "@/lib/domain";
import { fail, requireCustomer } from "@/lib/http";
import { speakAmount } from "@/lib/money";
import { AGENT_LANG, agentToken } from "@/lib/voice/agentToken";
import { isLang, type Lang } from "@/lib/voice/sentences";

/**
 * Starts the live banking assistant: the customer can ask about their limit, what they spent, who they
 * paid, their pay code and how the app works. It is given only this customer's records from our own
 * store, has no tools except ending the call, and cannot move money. Built 18 Nov.
 */
const AGENT_ID = process.env.ELEVENLABS_ASSISTANT_ID || "agent_9301m7pfvgsgfzhbs847n6namcwv";

const NAMES: Record<Lang, string> = { en: "English", pcm: "Nigerian Pidgin", yo: "Yoruba", ig: "English (the customer chose Igbo, which this voice cannot speak yet)", ha: "Hausa" };
const HELLO: Record<Lang, string> = {
  en: "Hello. I am Pay Alone. You can ask me what is left of your limit, who you paid, or how anything works.",
  pcm: "How far. Na me be Pay Alone. You fit ask me wetin remain for your limit, who you don pay, or how anything dey work.",
  yo: "Ẹ n lẹ. Èmi ni Pay Alone. Ẹ lè bi mí léèrè iye tó kù nínú òdiwọ̀n yín, ẹni tí ẹ sanwó fún, tàbí bí nǹkan ṣe ń ṣiṣẹ́.",
  ig: "Hello. I am Pay Alone. You can ask me what is left of your limit, who you paid, or how anything works.",
  ha: "Sannu. Ni ne Pay Alone. Kana iya tambaye ni nawa ya rage a iyakarka, wa ka biya, ko yadda komai ke aiki.",
};

const STATUS: Record<string, string> = {
  paid: "paid",
  declined: "refused by the customer, nothing paid",
  expired: "not answered in time, nothing paid",
  failed: "did not go through, nothing paid",
  consent: "waiting for the wallet's own page",
  paying: "being paid",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true });
}

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const lang: Lang = isLang(q.get("lang")) ? (q.get("lang") as Lang) : "en";
    const customer = await requireCustomer();
    const token = await agentToken(AGENT_ID);
    if (!token) return Response.json({ error: { kind: "unavailable", message: "The voice assistant is not available right now." } }, { status: 502 });

    const cap = capSummary(customer.cap);
    const active = cap && cap.status === "active" ? cap : null;
    const history = await customerHistory(customer);
    const lines = history.slice(0, 15).map((h) => {
      const amount = h.status === "paid" && h.debitAmount ? speakAmount(h.debitAmount) : speakAmount(h.requested);
      const why = h.failure?.message ? ` (${h.failure.message})` : "";
      return `- ${when(h.at)}: ${h.merchantName} asked for ${speakAmount(h.requested)}; ${STATUS[h.status] ?? h.status}${h.status === "paid" ? `, ${amount} left the account` : why}.`;
    });
    const contacts = Object.values(customer.contacts)
      .sort((a, b) => b.lastPaidAt.localeCompare(a.lastPaidAt))
      .slice(0, 15)
      .map((c) => `${c.name} (paid ${c.paidCount} time${c.paidCount === 1 ? "" : "s"}, last on ${when(c.lastPaidAt)})`);
    const fingers = (customer.passkeys?.length ?? 0) + (customer.deviceKeys?.length ?? 0);

    return Response.json(
      {
        token,
        language: AGENT_LANG[lang],
        dynamicVariables: {
          first_message: HELLO[lang],
          customer_name: customer.wallet.publicName ?? "the customer",
          language_name: NAMES[lang],
          now: when(new Date().toISOString()),
          pay_code: customer.payCode.split("").join(" "),
          limit_text: active ? `${speakAmount(active.limit)} each ${active.every}` : cap ? "the limit was stopped, so every payment needs the wallet's own page" : "no limit set yet, so every payment needs the wallet's own page",
          spent_text: active ? speakAmount(active.spent) : "not tracked, no active limit",
          left_text: active ? speakAmount(active.left) : "not known, no active limit",
          period_ends: active?.periodEnds ? when(active.periodEnds) : "not known",
          fingerprint_text: fingers > 0 ? "set up; every payment needs the fingerprint" : "not set up yet",
          contacts_text: contacts.length ? contacts.join("; ") : "nobody yet",
          history_text: lines.length ? lines.join("\n") : "- nothing yet",
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
