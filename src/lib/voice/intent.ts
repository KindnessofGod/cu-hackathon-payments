// Turns what the customer said into one of three answers. Voice never approves money: "pay" only
// opens the fingerprint prompt, and the fingerprint approves. "no" refuses, which moves no money.
// Anything unclear, or a sentence holding both a yes and a no word, is "unclear" and nothing happens.
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
  en: ["no", "nope", "don't", "dont", "do not", "stop", "refuse", "cancel", "decline"],
  pcm: ["no", "no pay", "abeg no", "no send", "stop", "cancel", "refuse"],
  yo: ["rara", "ra ra", "ko", "mi o", "no"],
  ig: ["mba", "ewoo", "no"],
  ha: ["a'a", "aa", "a a", "babu", "kada", "no"],
};

/** Lower case, accents and tone marks removed, punctuation turned into spaces (apostrophes kept). */
export function normalise(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ọ]/g, "o")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function has(heard: string, words: string[]): boolean {
  return words.some((w) => heard.includes(` ${w} `));
}

export function intentOf(text: string, lang: Lang): Intent {
  const heard = normalise(text);
  // Check English words too: people mix languages.
  const pay = has(heard, PAY[lang]) || has(heard, PAY.en);
  const refuse = has(heard, REFUSE[lang]) || has(heard, REFUSE.en);
  if (pay && !refuse) return "pay";
  if (refuse && !pay) return "refuse";
  return "unclear";
}
