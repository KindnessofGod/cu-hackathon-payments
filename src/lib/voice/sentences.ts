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
  /** Short reminder after each reply. */
  again: string;
  who: (name: string, times: number) => string;
  noLimit: string;
  afterThis: (left: string) => string;
  over: string;
  help: string;
  unclear: string;
  /** What to do now to approve: fingerprint only, a tap then the fingerprint, or a tap only. */
  howto: Record<HowTo, string>;
}

export type HowTo = "finger" | "tapFinger" | "tap";

const W: Record<Lang, Words> = {
  en: {
    newPerson: (n) => `A new person you have never paid, called ${n},`,
    asking: (who, r, d) => `${who} is asking for ${r}. ${d} will leave your account.`,
    paid: (who, d) => `Paid. ${d} left your account for ${who}.`,
    notPaid: "Not paid. No money moved.",
    left: (l, lim) => `${l} is left of your limit of ${lim}.`,
    answer: "To pay, say pay. To refuse, say no.",
    again: "Say pay, or no.",
    who: (n, t) => (t > 0 ? `This is ${n}. You have paid them ${t === 1 ? "once" : `${t} times`} before.` : `This is ${n}. You have never paid this person before.`),
    noLimit: "You have no spending limit set, so your wallet will ask you on its own page.",
    afterThis: (l) => `If you pay, ${l} will be left.`,
    over: "This payment is more than what is left, so your wallet will refuse it.",
    help: "You can ask who is this, how much is left, or say again. To pay, say pay. To refuse, say no.",
    unclear: "Sorry, I did not catch that.",
    howto: { finger: "Now rest your finger on the Home button to pay.", tapFinger: "Now tap the screen once, then rest your finger on the Home button.", tap: "Now tap the screen once to pay." },
  },
  pcm: {
    newPerson: (n) => `New person wey you never pay before, ${n},`,
    asking: (who, r, d) => `${who} dey ask for ${r}. ${d} go comot from your account.`,
    paid: (who, d) => `E don pay. ${d} don comot from your account go ${who}.`,
    notPaid: "E no pay. No money move.",
    left: (l, lim) => `${l} remain for your limit of ${lim}.`,
    answer: "If you wan pay, talk pay. If you no want, talk no.",
    again: "Talk pay, or no.",
    who: (n, t) => (t > 0 ? `Na ${n}. You don pay am before.` : `Na ${n}. You never pay this person before.`),
    noLimit: "You never set limit, so your wallet go ask you for im own page.",
    afterThis: (l) => `If you pay, ${l} go remain.`,
    over: "This payment pass wetin remain, so your wallet no go gree.",
    help: "You fit ask who be this, how much remain, or make I talk am again. To pay, talk pay. To refuse, talk no.",
    unclear: "Sorry, I no hear you well.",
    howto: { finger: "Now put your finger for the Home button make you pay.", tapFinger: "Now tap the screen one time, then put your finger for the Home button.", tap: "Now tap the screen one time make you pay." },
  },
  yo: {
    newPerson: (n) => `Ẹni tuntun tí o kò sanwó fún rí, ${n},`,
    asking: (who, r, d) => `${who} ń béèrè ${r}. ${d} ni yóò jáde nínú àkáǹtì rẹ.`,
    paid: (who, d) => `A ti san án. ${d} ti jáde nínú àkáǹtì rẹ lọ sọ́dọ̀ ${who}.`,
    notPaid: "A kò san án. Kò sí owó tó jáde.",
    left: (l, lim) => `${l} ló kù nínú òdiwọ̀n ${lim} rẹ.`,
    answer: "Láti sanwó, sọ pé san. Láti kọ̀, sọ pé rárá.",
    again: "Sọ pé san, tàbí rárá.",
    who: (n, t) => (t > 0 ? `${n} ni. O ti sanwó fún wọn rí.` : `${n} ni. O kò tíì sanwó fún ẹni yìí rí.`),
    noLimit: "O kò tíì ṣètò òdiwọ̀n, nítorí náà àpamọ́wọ́ rẹ yóò béèrè lọ́wọ́ rẹ.",
    afterThis: (l) => `Tí o bá san án, ${l} ni yóò kù.`,
    over: "Owó yìí ju èyí tó kù lọ, nítorí náà àpamọ́wọ́ rẹ yóò kọ̀ ọ́.",
    help: "O lè béèrè ta ni, èló ló kù, tàbí kí n tún un sọ. Láti sanwó, sọ pé san. Láti kọ̀, sọ pé rárá.",
    unclear: "Ẹ má bínú, mi ò gbọ́ yín dáadáa.",
    howto: { finger: "Ní báyìí, fi ìka yín lé bọ́tìnnì Home láti sanwó.", tapFinger: "Ní báyìí, tẹ ojú fóònù lẹ́ẹ̀kan, lẹ́yìn náà fi ìka yín lé bọ́tìnnì Home.", tap: "Ní báyìí, tẹ ojú fóònù lẹ́ẹ̀kan láti sanwó." },
  },
  ig: {
    newPerson: (n) => `Onye ọhụrụ ị na-akwụbeghị ụgwọ, ${n},`,
    asking: (who, r, d) => `${who} na-arịọ ${r}. ${d} ga-esi n'akaụntụ gị pụọ.`,
    paid: (who, d) => `Akwụọla ụgwọ. ${d} esila n'akaụntụ gị gaa ${who}.`,
    notPaid: "Akwụghị ụgwọ. Ego ọ bụla esighị pụọ.",
    left: (l, lim) => `${l} fọdụrụ n'oke ${lim} gị.`,
    answer: "Ka ị kwụọ ụgwọ, kwuo kwụọ. Ka ị jụ, kwuo mba.",
    again: "Kwuo kwụọ, ma ọ bụ mba.",
    who: (n, t) => (t > 0 ? `Ọ bụ ${n}. Ị kwụọla onye a ụgwọ na mbụ.` : `Ọ bụ ${n}. Ị kwụbeghị onye a ụgwọ.`),
    noLimit: "Ị setịghị oke, ya mere obere akpa gị ga-ajụ gị.",
    afterThis: (l) => `Ọ bụrụ na ị kwụọ, ${l} ga-afọdụ.`,
    over: "Ego a karịrị nke fọdụrụ, ya mere obere akpa gị ga-ajụ ya.",
    help: "Ị nwere ike ịjụ onye bụ ya, ego ole fọdụrụ, ma ọ bụ ka m kwuo ya ọzọ. Ka ị kwụọ, kwuo kwụọ. Ka ị jụ, kwuo mba.",
    unclear: "Ndo, anụghị m gị nke ọma.",
    howto: { finger: "Ugbu a, tinye mkpịsị aka gị na bọtịnụ Home ka ị kwụọ ụgwọ.", tapFinger: "Ugbu a, metụ ihuenyo otu ugboro, wee tinye mkpịsị aka gị na bọtịnụ Home.", tap: "Ugbu a, metụ ihuenyo otu ugboro ka ị kwụọ ụgwọ." },
  },
  ha: {
    newPerson: (n) => `Sabon mutum da ba ka taɓa biya ba, ${n},`,
    asking: (who, r, d) => `${who} yana neman ${r}. ${d} zai fita daga asusunka.`,
    paid: (who, d) => `An biya. ${d} ya fita daga asusunka zuwa ${who}.`,
    notPaid: "Ba a biya ba. Babu kuɗin da ya fita.",
    left: (l, lim) => `${l} ya rage a cikin iyakar ${lim} naka.`,
    answer: "Don ka biya, ka ce biya. Don ka ƙi, ka ce a'a.",
    again: "Ka ce biya, ko a'a.",
    who: (n, t) => (t > 0 ? `${n} ne. Ka taɓa biyan wannan mutum a baya.` : `${n} ne. Ba ka taɓa biyan wannan mutum ba.`),
    noLimit: "Ba ka saita iyaka ba, don haka walat ɗinka zai tambaye ka.",
    afterThis: (l) => `Idan ka biya, ${l} zai rage.`,
    over: "Wannan kuɗin ya fi abin da ya rage, don haka walat ɗinka zai ƙi.",
    help: "Kana iya tambaya wanene, nawa ya rage, ko in sake faɗa. Don ka biya, ka ce biya. Don ka ƙi, ka ce a'a.",
    unclear: "Yi haƙuri, ban ji ka sosai ba.",
    howto: { finger: "Yanzu, ɗora yatsanka a kan maɓallin Home don ka biya.", tapFinger: "Yanzu, taɓa allon sau ɗaya, sannan ka ɗora yatsanka a kan maɓallin Home.", tap: "Yanzu, taɓa allon sau ɗaya don ka biya." },
  },
};

export function askingSentence(lang: Lang, a: { name: string; known: boolean; receive: Amount; debit: Amount }) {
  const w = W[lang];
  const r = speakAmount(a.receive);
  const d = speakAmount(a.debit);
  const full = w.asking(a.known ? a.name : w.newPerson(a.name), r, d);
  // No fee: the same amount twice is just noise, so keep only the first sentence ("X is asking for ...").
  return r === d ? full.slice(0, full.indexOf(". ") + 1) || full : full;
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

export type ReplyKind = "who" | "left" | "help" | "unclear";

/** The app's spoken answer to a question during a payment request, then the short "say pay or no". */
export function replySentence(
  lang: Lang,
  kind: ReplyKind,
  a: { name: string; timesPaid: number; left?: Amount; limit?: Amount; leftAfter?: Amount; over?: boolean },
) {
  const w = W[lang];
  let text: string;
  if (kind === "who") text = w.who(a.name, a.timesPaid);
  else if (kind === "left")
    text = a.left && a.limit
      ? `${w.left(speakAmount(a.left), speakAmount(a.limit))} ${a.over ? w.over : a.leftAfter ? w.afterThis(speakAmount(a.leftAfter)) : ""}`.trim()
      : w.noLimit;
  else if (kind === "help") return w.help;
  else text = w.unclear;
  return `${text} ${w.again}`;
}

/** After a payment: what is left of the limit, in the same language. */
export function paidWithLeftSentence(lang: Lang, a: { name: string; debit: Amount; left?: Amount; limit?: Amount }) {
  const w = W[lang];
  const paid = w.paid(a.name, speakAmount(a.debit));
  return a.left && a.limit ? `${paid} ${w.left(speakAmount(a.left), speakAmount(a.limit))}` : paid;
}

/** The spoken instruction for approving a payment, said by the app itself so it is never left out. */
export function howtoSentence(lang: Lang, how: HowTo) {
  return W[lang].howto[how];
}
