// A pretend wallet for the experiment. No real money, no Open Payments calls: the point is to
// measure voice and AI costs, not to move money. The fingerprint is simulated as "approved at once",
// which is fair because in this design nothing is billed while the fingerprint screen is up.
import type { Amount } from "../../src/lib/money";
import { exceedsCap, remainingOfCap, speakAmount } from "../../src/lib/money";
import { askingSentence, answerSentence, howtoSentence, paidWithLeftSentence, resultSentence, type Lang } from "../../src/lib/voice/sentences";

const ngn = (naira: number): Amount => ({ value: String(Math.round(naira * 100)), assetCode: "NGN", assetScale: 2 });
const naira = (a: Amount) => Number(a.value) / 100;

export interface Pending {
  name: string;
  amount: Amount;
  known: boolean;
}

export class MockWallet {
  limit = ngn(135397);
  spent = ngn(72031);
  savings = ngn(2500);
  contacts: Record<string, number> = { "Mama Chris": 12, Chioma: 3 };
  history: { day: string; name: string; naira: number; status: string }[] = [
    { day: "today", name: "Mama Chris", naira: 10006, status: "paid" },
    { day: "today", name: "Mama Chris", naira: 2004, status: "paid" },
    { day: "yesterday", name: "Chioma", naira: 5000, status: "paid" },
    { day: "3 days ago", name: "Mama Chris", naira: 10006, status: "refused" },
    { day: "5 days ago", name: "Savings", naira: 501, status: "saved" },
  ];
  pending: Pending | null = null;

  constructor(public lang: Lang) {}

  left(): Amount {
    return remainingOfCap(this.limit, this.spent);
  }

  /** Facts the AI gets on every turn: kept short on purpose (a few hundred characters). */
  facts(): string {
    const p = this.pending ? `${this.pending.name} is asking for ${speakAmount(this.pending.amount)}.` : "No request is waiting.";
    return [
      `Waiting request: ${p}`,
      `Weekly limit: ${speakAmount(this.limit)}; left: ${speakAmount(this.left())}.`,
      `Saved contacts: ${Object.keys(this.contacts).join(", ")}.`,
    ].join("\n");
  }

  /** A seller asks for money: the app reads it with its own sentence, never the AI's words. */
  request(name: string, amountNaira: number): string[] {
    this.pending = { name, amount: ngn(amountNaira), known: name in this.contacts };
    return [askingSentence(this.lang, { name, known: this.pending.known, receive: this.pending.amount, debit: this.pending.amount }), answerSentence(this.lang)];
  }

  /** Runs one tool. Returns what to tell the AI, plus any sentence the app itself must say. */
  run(name: string, args: Record<string, unknown>): { result: string; say: string[] } {
    switch (name) {
      case "send_money": {
        const who = String(args.contact_name ?? "");
        const match = Object.keys(this.contacts).find((c) => c.toLowerCase() === who.toLowerCase());
        const amount = Number(args.amount_naira);
        if (!match) return { result: `No saved contact called ${who}. Saved: ${Object.keys(this.contacts).join(", ")}.`, say: [] };
        if (!(amount > 0)) return { result: "Amount missing or not a number. Ask how much.", say: [] };
        const say = this.request(match, amount);
        return { result: "Request created and already read out by the app with the exact amount. Do not repeat the amount. Wait for pay or no.", say };
      }
      case "approve_payment": {
        if (!this.pending) return { result: "No request is waiting.", say: [] };
        const p = this.pending;
        this.pending = null;
        const how = howtoSentence(this.lang, "finger");
        if (exceedsCap(this.limit, this.spent, p.amount)) return { result: "Refused by the wallet: over the limit. The app told the customer.", say: [how, resultSentence(this.lang, { paid: false, name: p.name })] };
        this.spent = ngn(naira(this.spent) + naira(p.amount));
        this.contacts[p.name] = (this.contacts[p.name] ?? 0) + 1;
        this.history.unshift({ day: "today", name: p.name, naira: naira(p.amount), status: "paid" });
        return {
          result: "Fingerprint given; PAID. The app has already said the result and what is left. Say nothing more about it.",
          say: [how, paidWithLeftSentence(this.lang, { name: p.name, debit: p.amount, left: this.left(), limit: this.limit })],
        };
      }
      case "refuse_payment": {
        if (!this.pending) return { result: "No request is waiting.", say: [] };
        this.pending = null;
        return { result: "Refused. Nothing paid. The app has said so.", say: [resultSentence(this.lang, { paid: false, name: "" })] };
      }
      case "save_money": {
        const amount = Number(args.amount_naira);
        if (!(amount > 0)) return { result: "Amount missing. Ask how much to save.", say: [] };
        this.savings = ngn(naira(this.savings) + amount);
        return { result: `Saved ${amount} naira after the fingerprint. Savings now ${naira(this.savings)} naira.`, say: [howtoSentence(this.lang, "finger")] };
      }
      case "my_savings_and_investments":
        return { result: `Savings: ${naira(this.savings)} naira. Practice investments: Dangote Cement, 23 shares, worth about 30,505 naira.`, say: [] };
      case "payment_history":
        return { result: this.history.map((h) => `${h.day}: ${h.name}, ${h.naira} naira, ${h.status}`).join("\n"), say: [] };
      case "change_limit":
        return { result: "A new limit needs the fingerprint and the wallet's own page. Tell them the app will open it.", say: [] };
      case "market_overview":
        return { result: "Practice data: Dangote Cement up 1.2% today, MTN Nigeria down 0.4%. Not financial advice.", say: [] };
      case "end_conversation":
        return { result: "Ended.", say: [] };
      default:
        return { result: `Unknown tool ${name}.`, say: [] };
    }
  }
}

/** The same tools your live agent has, described for Gemini function calling. */
export const TOOL_DECLARATIONS = [
  { name: "send_money", description: "Start a payment to a SAVED contact. The app reads the exact amount aloud; only the fingerprint pays.", parameters: { type: "object", properties: { contact_name: { type: "string" }, amount_naira: { type: "number" } }, required: ["contact_name", "amount_naira"] } },
  { name: "approve_payment", description: "The customer clearly said yes/pay to the waiting request. Opens the fingerprint prompt. Never call without a clear yes.", parameters: { type: "object", properties: {} } },
  { name: "refuse_payment", description: "The customer said no to the waiting request.", parameters: { type: "object", properties: {} } },
  { name: "save_money", description: "Move money into savings (needs the fingerprint).", parameters: { type: "object", properties: { amount_naira: { type: "number" } }, required: ["amount_naira"] } },
  { name: "my_savings_and_investments", description: "What is in savings and practice investments.", parameters: { type: "object", properties: {} } },
  { name: "payment_history", description: "Recent payments, for questions like what did I spend or who did I pay.", parameters: { type: "object", properties: {} } },
  { name: "change_limit", description: "The customer wants a different weekly spending limit.", parameters: { type: "object", properties: { new_weekly_naira: { type: "number" } } } },
  { name: "market_overview", description: "Practice market data. Always say it is not financial advice.", parameters: { type: "object", properties: {} } },
  { name: "end_conversation", description: "The customer is done (thank you, bye).", parameters: { type: "object", properties: {} } },
];
