// The conversations the experiment plays. Each user turn is what the customer says; the experiment
// turns it into audio once (or uses your own recording), then runs it through the full loop.
//
// To use real voices instead of generated ones, record WAV files (16 kHz mono is fine) and save
// them as experiments/voice-cost/audio/<scenario id>-<turn number>.wav, e.g. pay-simple-1.wav.
import type { Lang } from "../../src/lib/voice/sentences";

export interface Scenario {
  id: string;
  lang: Lang;
  /** A seller's request that arrives before the customer speaks, if any. */
  request?: { name: string; naira: number };
  turns: string[];
  /** What a correct run should do, checked loosely at the end (tools called or fast replies). */
  expect: string[];
}

export const SCENARIOS: Scenario[] = [
  { id: "pay-simple", lang: "en", request: { name: "Mama Chris", naira: 10006 }, turns: ["Pay."], expect: ["pay"] },
  { id: "refuse", lang: "pcm", request: { name: "Mama Chris", naira: 10006 }, turns: ["No, I no wan pay am."], expect: ["refuse"] },
  { id: "ask-then-pay", lang: "pcm", request: { name: "Mama Chris", naira: 10006 }, turns: ["Who be this?", "How much remain for my limit?", "Okay, pay am."], expect: ["who", "left", "pay"] },
  { id: "free-pidgin-pay", lang: "pcm", request: { name: "Mama Chris", naira: 10006 }, turns: ["Abeg make we settle Mama Chris, she don dey wait for her money since morning."], expect: ["approve_payment"] },
  { id: "send-by-voice", lang: "en", turns: ["Send five thousand naira to Chioma.", "Yes, pay."], expect: ["send_money", "pay"] },
  { id: "spend-question", lang: "pcm", turns: ["How much I don spend this week, and who I pay pass?"], expect: ["payment_history"] },
  { id: "two-things", lang: "en", request: { name: "Mama Chris", naira: 10006 }, turns: ["Pay Mama Chris, then save two thousand naira for me."], expect: ["approve_payment", "save_money"] },
  { id: "yoruba-pay", lang: "yo", request: { name: "Mama Chris", naira: 10006 }, turns: ["Ẹ jọ̀ọ́, ẹ sanwó fún Mama Chris."], expect: ["approve_payment"] },
  { id: "savings-question", lang: "pcm", turns: ["Wetin dey my savings now? And how my Dangote shares dey?"], expect: ["my_savings_and_investments"] },
  { id: "unclear", lang: "en", request: { name: "Mama Chris", naira: 10006 }, turns: ["Hmm, wait first, let me think about it.", "No."], expect: ["refuse"] },
];
