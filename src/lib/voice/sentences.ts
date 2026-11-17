// Every sentence the hosted voice can say. The server fills them in from its own records (the quote and
// the payment result), never from text sent by a browser, so a voice provider can only ever be asked to
// read our own figures. Amounts are said in English inside every language, as people do (see VOICE_PLAN).
//
// The Pidgin, Yoruba, Igbo and Hausa wording was written by Claude and has NOT been checked by a native
// speaker. The app says so wherever a language is chosen.
import { speakAmount, type Amount } from "../money";

export type Lang = "en" | "pcm" | "yo" | "ig" | "ha";
export const LANGS: Lang[] = ["en", "pcm", "yo", "ig", "ha"];

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as string[]).includes(x);
}

interface Words {
  newPerson: (name: string) => string;
  asking: (who: string, receive: string, debit: string) => string;
  paid: (who: string, debit: string) => string;
  notPaid: string;
  left: (left: string, limit: string) => string;
  answer: string;
}

const W: Record<Lang, Words> = {
  en: {
    newPerson: (n) => `A new person you have never paid, called ${n},`,
    asking: (who, r, d) => `${who} is asking for ${r}. ${d} will leave your account.`,
    paid: (who, d) => `Paid. ${d} left your account for ${who}.`,
    notPaid: "Not paid. No money moved.",
    left: (l, lim) => `${l} is left of your limit of ${lim}.`,
    answer: "To pay, say pay. To refuse, say no.",
  },
  pcm: {
    newPerson: (n) => `New person wey you never pay before, ${n},`,
    asking: (who, r, d) => `${who} dey ask for ${r}. ${d} go comot from your account.`,
    paid: (who, d) => `E don pay. ${d} don comot from your account go ${who}.`,
    notPaid: "E no pay. No money move.",
    left: (l, lim) => `${l} remain for your limit of ${lim}.`,
    answer: "If you wan pay, talk pay. If you no want, talk no.",
  },
  yo: {
    newPerson: (n) => `Ẹni tuntun tí o kò sanwó fún rí, ${n},`,
    asking: (who, r, d) => `${who} ń béèrè ${r}. ${d} ni yóò jáde nínú àkáǹtì rẹ.`,
    paid: (who, d) => `A ti san án. ${d} ti jáde nínú àkáǹtì rẹ lọ sọ́dọ̀ ${who}.`,
    notPaid: "A kò san án. Kò sí owó tó jáde.",
    left: (l, lim) => `${l} ló kù nínú òdiwọ̀n ${lim} rẹ.`,
    answer: "Láti sanwó, sọ pé san. Láti kọ̀, sọ pé rárá.",
  },
  ig: {
    newPerson: (n) => `Onye ọhụrụ ị na-akwụbeghị ụgwọ, ${n},`,
    asking: (who, r, d) => `${who} na-arịọ ${r}. ${d} ga-esi n'akaụntụ gị pụọ.`,
    paid: (who, d) => `Akwụọla ụgwọ. ${d} esila n'akaụntụ gị gaa ${who}.`,
    notPaid: "Akwụghị ụgwọ. Ego ọ bụla esighị pụọ.",
    left: (l, lim) => `${l} fọdụrụ n'oke ${lim} gị.`,
    answer: "Ka ị kwụọ ụgwọ, kwuo kwụọ. Ka ị jụ, kwuo mba.",
  },
  ha: {
    newPerson: (n) => `Sabon mutum da ba ka taɓa biya ba, ${n},`,
    asking: (who, r, d) => `${who} yana neman ${r}. ${d} zai fita daga asusunka.`,
    paid: (who, d) => `An biya. ${d} ya fita daga asusunka zuwa ${who}.`,
    notPaid: "Ba a biya ba. Babu kuɗin da ya fita.",
    left: (l, lim) => `${l} ya rage a cikin iyakar ${lim} naka.`,
    answer: "Don ka biya, ka ce biya. Don ka ƙi, ka ce a'a.",
  },
};

export function askingSentence(lang: Lang, a: { name: string; known: boolean; receive: Amount; debit: Amount }) {
  const w = W[lang];
  return w.asking(a.known ? a.name : w.newPerson(a.name), speakAmount(a.receive), speakAmount(a.debit));
}

export function resultSentence(lang: Lang, a: { paid: boolean; name: string; debit?: Amount }) {
  const w = W[lang];
  return a.paid && a.debit ? w.paid(a.name, speakAmount(a.debit)) : w.notPaid;
}

export function leftSentence(lang: Lang, left: Amount, limit: Amount) {
  return W[lang].left(speakAmount(left), speakAmount(limit));
}

/** The spoken instruction after a request: say pay or no. Saying pay only opens the fingerprint prompt. */
export function answerSentence(lang: Lang) {
  return W[lang].answer;
}
