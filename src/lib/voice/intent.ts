// Turns what the customer said into one of three answers. Voice never approves money: "pay" only
// opens the fingerprint prompt, and the fingerprint approves. "no" refuses, which moves no money.
// Any "no" word makes the answer a refusal; anything without a yes or no word is "unclear" and nothing happens.
// Only short answers count (MAX_WORDS): a long sentence is more likely the app's own voice picked up by
// the microphone, or a sentence such as "you have never paid", than an answer.
//
// The non-English words were chosen by Claude and have NOT been checked by a native speaker.
import type { Lang } from "./sentences";

export type Intent = "pay" | "refuse" | "unclear";

const PAY: Record<Lang, string[]> = {
  en: ["pay", "yes", "yeah", "approve", "send", "okay", "ok", "go ahead"],
  pcm: ["pay", "pay am", "yes", "oya", "send am", "make i pay", "okay", "ok"],
  yo: ["san", "sanwo", "beeni", "bee ni", "o da", "pay", "yes"],
  ig: ["kwuo", "kwuo ugwo", "ee", "eh", "kwu", "pay", "yes"],
  ha: ["biya", "eh", "ee", "na yarda", "pay", "yes"],
};

const REFUSE: Record<Lang, string[]> = {
  en: ["no", "nope", "don't pay", "dont pay", "do not pay", "don't", "dont", "do not", "stop", "refuse", "cancel", "decline"],
  pcm: ["no pay", "no", "abeg no", "no send", "no send am", "stop", "cancel", "refuse"],
  yo: ["ma san", "rara", "ra ra", "ko", "mi o", "no"],
  ig: ["akwula", "ekwula", "mba", "ewoo", "no"],
  ha: ["kada ka biya", "a'a", "aa", "a a", "babu", "kada", "ba", "no"],
};

/** Lower case, accents and tone marks removed, punctuation turned into spaces (apostrophes kept). */
export function normalise(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function has(heard: string, words: string[]): boolean {
  return words.some((w) => heard.includes(` ${w} `));
}

export const MAX_WORDS = 5;

export function intentOf(text: string, lang: Lang): Intent {
  const heard = normalise(text);
  if (heard.trim().split(" ").length > MAX_WORDS) return "unclear";
  // Check English words too: people mix languages. Any "no" word wins, because refusing moves no
  // money: "don't pay", "no pay" and "ba a biya ba" (Hausa, "not paid") are all refusals.
  if (has(heard, REFUSE[lang]) || has(heard, REFUSE.en)) return "refuse";
  if (has(heard, PAY[lang]) || has(heard, PAY.en)) return "pay";
  return "unclear";
}
