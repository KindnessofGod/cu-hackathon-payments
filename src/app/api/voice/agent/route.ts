import { balanceEstimate, capSummary, customerHistory, getRequestFor, isOpen, payeesOf } from "@/lib/domain";
import { fail, requireCustomer } from "@/lib/http";
import { getStore } from "@/lib/store";
import { exceedsCap, remainingOfCap, speakAmount } from "@/lib/money";
import { growSummary, growText } from "@/lib/grow";
import { askingSentence, isLang, type Lang } from "@/lib/voice/sentences";
import { AGENT_LANG, agentSignedUrl, agentToken } from "@/lib/voice/agentToken";

/**
 * Starts the live voice conversation with the one Pay Alone agent (ElevenLabs Agents, WebRTC).
 * Returns a one-time token and the facts the agent may use: this customer's records in this app and,
 * if `id` is given, the payment waiting for an answer. Every name and amount comes from our records
 * and the wallet's quote. The agent's tools run in the browser: it can start a payment to someone
 * the customer has paid before and open the fingerprint prompt, but only the fingerprint (or, with
 * no fingerprint set up, a tap) approves a payment.
 */
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || "agent_5501m7pg7m7eezp8p00mnemah8g0";

const NAMES: Record<Lang, string> = { en: "English", pcm: "Nigerian Pidgin", yo: "Yoruba", ig: "English (the customer chose Igbo, which this voice cannot speak yet)", ha: "Hausa" };
const HELLO: Record<Lang, string> = {
  en: "Hello, I am Pay Alone. How can I help you?",
  pcm: "How far, na me be Pay Alone. Wetin I fit do for you?",
  yo: "Ẹ n lẹ, èmi ni Pay Alone. Kí ni mo lè ṣe fún yín?",
  ig: "Hello, I am Pay Alone. How can I help you?",
  ha: "Sannu, ni ne Pay Alone. Me zan iya yi maka?",
};
const STATUS: Record<string, string> = {
  paid: "paid",
  declined: "refused, nothing paid",
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
    const native = q.get("native") === "1";
    const customer = await requireCustomer();
    const id = q.get("id");
    const r = id ? await getRequestFor(customer, id) : null;
    if (r && (!isOpen(r) || !r.quote)) return Response.json({ error: { kind: "not_ready", message: "This request is not waiting for an answer." } }, { status: 409 });

    const [token, signedUrl] = await Promise.all([agentToken(AGENT_ID), agentSignedUrl(AGENT_ID)]);
    if (!token && !signedUrl) return Response.json({ error: { kind: "unavailable", message: "Live voice is not available right now." } }, { status: 502 });

    // The customer's own records.
    const cap = capSummary(customer.cap);
    const active = cap && cap.status === "active" ? cap : null;
    const history = (await customerHistory(customer)).slice(0, 15).map((h) => {
      const what = h.status === "paid" && h.debitAmount ? `, ${speakAmount(h.debitAmount)} left the account` : h.failure?.message ? ` (${h.failure.message})` : "";
      return `- ${when(h.at)}: ${h.merchantName}, ${speakAmount(h.requested)}; ${STATUS[h.status] ?? h.status}${what}.`;
    });
    const contacts = (await payeesOf(customer)).slice(0, 15).map((p) => {
      const c = customer.contacts[p.walletId];
      return c ? `${p.name} (paid ${c.paidCount} time${c.paidCount === 1 ? "" : "s"}, last on ${when(c.lastPaidAt)})` : `${p.name} (never paid; asked for money in the last day)`;
    });
    let grow = "not available right now";
    try {
      grow = growText(await growSummary(customer));
    } catch {
      /* keep the call going without it */
    }
    const hasDevice = Boolean(customer.deviceKeys?.length);
    const hasPasskey = Boolean(customer.passkeys?.length);
    const approveHow =
      native && hasDevice
        ? "Rest your finger on the Home button."
        : hasPasskey
          ? q.get("tap") === "1"
            ? "Tap the screen once, then rest your finger on the Home button."
            : "Rest your finger on the Home button."
          : hasDevice
            ? "Open the Pay Alone app on this iPad to approve with your fingerprint."
            : "Tap the screen once to pay.";

    // The conversation before the app reloaded (the wallet's page for a new limit ends the call):
    // the last lines of this customer's latest call in the past 20 minutes, so the agent can carry on.
    type Line = { at: string; who: "you" | "app" | "tool"; text: string };
    const convs = (await getStore().list<{ customerId: string; updatedAt: string; lines: Line[] }>("conversations"))
      .filter((c) => c.customerId === customer.id && Date.now() - Date.parse(c.updatedAt) < 20 * 60_000)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const recentChat = convs[0]
      ? convs[0].lines
          .filter((l) => l.who !== "tool")
          .slice(-8)
          .map((l) => `${l.who === "you" ? "Customer" : "You"}: ${l.text.replace(/\[[^\]]*\]\s*/g, "")}`)
          .join("\n")
      : "none";

    // The waiting payment, if any. Amounts from the wallet's quote.
    let pending = "none";
    let first = HELLO[lang];
    // Just back from the wallet's page with a new limit: say so first.
    if (active && Date.now() - Date.parse(active.grantedAt) < 3 * 60_000) {
      first = `Welcome back. Your new spending limit is set: ${speakAmount(active.limit)} each ${active.every}. What would you like to do next?`;
    }
    if (r && r.quote) {
      const { receiveAmount, debitAmount } = r.quote;
      const over = Boolean(active && exceedsCap(active.limit, active.spent, debitAmount));
      const timesPaid = customer.contacts[r.merchantWalletId]?.paidCount ?? 0;
      pending = [
        r.purpose === "save"
          ? "The customer is moving money INTO THEIR OWN SAVINGS wallet (they asked for this)."
          : r.purpose === "invest" && r.invest
            ? `The customer is making a PRACTICE investment in ${r.invest.name} with test money (they asked for this); it records about ${(Number(r.invest.unitsMicro) / 1e6).toFixed(4)} shares at ${(Number(r.invest.priceMinor) / 100).toFixed(2)} ${r.invest.currency === "NGN" ? "naira" : "dollars"} each.`
            : r.outgoing
              ? `The customer is SENDING money to ${r.merchantName} (they asked for this).`
              : `${r.merchantName} is ASKING the customer for money.`,
        `${r.merchantName} will receive ${speakAmount(receiveAmount)}.`,
        `${speakAmount(debitAmount)} will leave the customer's account, fees included.`,
        `Times paid this person before: ${timesPaid}.`,
        active ? (over ? "This is OVER the limit, so the wallet will refuse it." : `After this payment, ${speakAmount(remainingOfCap(active.left, debitAmount))} will be left of the limit.`) : "No limit is set, so the wallet will open its own page to confirm this one payment.",
      ].join(" ");
      if (!r.outgoing) {
        const firstLang: Lang = lang === "ig" ? "en" : lang;
        first = askingSentence(firstLang, { name: r.merchantName, known: timesPaid > 0, receive: receiveAmount, debit: debitAmount });
      }
    }

    const bal = await balanceEstimate(customer);
    const balanceText = bal
      ? `${speakAmount(bal.amount)}. Pay Alone works this out: the wallet showed ${speakAmount({ ...bal.amount, value: (BigInt(bal.amount.value) + BigInt(bal.paidSince.value)).toString() })} on ${when(bal.asOf)}, and ${bal.count} payment${bal.count === 1 ? "" : "s"} made through Pay Alone since then took ${speakAmount(bal.paidSince)}. Money received or paid outside Pay Alone is not counted.`
      : "not known: the wallet does not let apps read the balance, and no figure from the wallet has been noted yet";

    return Response.json(
      {
        token,
        signedUrl,
        language: AGENT_LANG[lang],
        dynamicVariables: {
          first_message: first,
          customer_name: customer.wallet.publicName ?? "the customer",
          language_name: NAMES[lang],
          now: when(new Date().toISOString()),
          pay_code: customer.payCode.split("").join(" "),
          limit_text: active ? `${speakAmount(active.limit)} each ${active.every}` : cap ? "the limit was stopped, so every payment needs the wallet's own page" : "no limit set yet, so every payment needs the wallet's own page",
          spent_text: active ? speakAmount(active.spent) : "not tracked, no active limit",
          left_text: active ? speakAmount(active.left) : "not known, no active limit",
          period_ends: active?.periodEnds ? when(active.periodEnds) : "not known",
          fingerprint_text: hasDevice || hasPasskey ? "set up; every payment needs the fingerprint" : "not set up; a tap on the screen approves",
          contacts_text: contacts.length ? contacts.join("; ") : "nobody yet",
          history_text: history.length ? history.join("\n") : "- nothing yet",
          pending_text: pending,
          approve_how: approveHow,
          grow_text: grow,
          balance_text: balanceText,
          recent_chat: recentChat,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
