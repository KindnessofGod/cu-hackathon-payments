// Turns what the customer said into what they want. Voice never approves money: "pay" only opens the
// fingerprint prompt, and the fingerprint approves. "no" refuses, which moves no money.
// Questions ("who is this?", "how much is left?", "say it again", "help") are checked first: they only
// make the app answer and listen again, so mistaking one costs nothing. Then any "no" word refuses,
// then a "yes" word means pay. Anything else is "unclear" and nothing happens.
// Long sentences (over MAX_WORDS) are ignored: they are more likely the app's own voice picked up by
// the microphone, or a sentence such as "you have never paid", than an answer.
//
// The non-English words were chosen by Claude and have NOT been checked by a native speaker.
import type { Lang } from "./sentences";

export type Intent = "pay" | "refuse" | "who" | "left" | "repeat" | "help" | "unclear";

const WHO: Record<Lang, string[]> = {
  en: ["who", "whose", "who is", "name", "which person"],
  pcm: ["who", "who be", "na who", "who dey"],
  yo: ["tani", "ta ni", "oruko", "ewo"],
  ig: ["onye", "aha", "onye bu"],
  ha: ["wane", "wanene", "wace", "suna", "wa"],
};

const LEFT: Record<Lang, string[]> = {
  en: ["left", "remain", "remaining", "balance", "limit", "how much do i have", "how much have i got", "money do i have"],
  pcm: ["remain", "wetin remain", "how much remain", "balance", "limit", "left"],
  yo: ["ku", "melo lo ku", "elo lo ku", "odiwon", "iye owo"],
  ig: ["foduru", "ole foduru", "oke", "ego ole"],
  ha: ["rage", "saura", "nawa ya rage", "iyaka"],
};

const REPEAT: Record<Lang, string[]> = {
  en: ["again", "repeat", "pardon", "say that", "what did you say", "sorry", "come again"],
  pcm: ["again", "talk am again", "wetin you talk", "wetin", "sorry"],
  yo: ["tun", "tun so", "kini", "e jo", "ki lo so"],
  ig: ["ozo", "kwuo ya ozo", "gini", "biko"],
  ha: ["sake", "maimaita", "me", "me ka ce"],
};

const HELP: Record<Lang, string[]> = {
  en: ["help", "what can i say", "what can i do", "options"],
  pcm: ["help", "help me", "wetin i fit talk"],
  yo: ["ran mi lowo", "iranlowo", "help"],
  ig: ["nyere m aka", "enyemaka", "help"],
  ha: ["taimake", "taimako", "help"],
};

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

export const MAX_WORDS = 9;

export function intentOf(text: string, lang: Lang): Intent {
  const heard = normalise(text);
  if (heard.trim().split(" ").length > MAX_WORDS) return "unclear";
  // Check English words too: people mix languages.
  const said = (list: Record<Lang, string[]>) => has(heard, list[lang]) || has(heard, list.en);
  // Questions first: they only make the app answer and listen again. "how much is left" before "what".
  if (said(HELP)) return "help";
  if (said(LEFT)) return "left";
  if (said(WHO)) return "who";
  if (said(REPEAT) || ["what", "huh", "wetin", "kini", "gini"].includes(heard.trim())) return "repeat";
  // Any "no" word wins over "yes", because refusing moves no money:
  // "don't pay", "no pay" and "ba a biya ba" (Hausa, "not paid") are all refusals.
  if (has(heard, REFUSE[lang]) || has(heard, REFUSE.en)) return "refuse";
  if (has(heard, PAY[lang]) || has(heard, PAY.en)) return "pay";
  return "unclear";
}
