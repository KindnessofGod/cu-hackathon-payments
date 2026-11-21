// Money is always an integer count of minor units held in a string, plus the asset's code and scale.
// No floating point is used anywhere in this file.

export interface Amount {
  value: string; // minor units, digits only
  assetCode: string;
  assetScale: number;
}

const DIGITS = /^\d+$/;

export function isAmount(a: unknown): a is Amount {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return (
    typeof x.value === "string" &&
    DIGITS.test(x.value) &&
    typeof x.assetCode === "string" &&
    x.assetCode.length > 0 &&
    typeof x.assetScale === "number" &&
    Number.isInteger(x.assetScale) &&
    x.assetScale >= 0 &&
    x.assetScale <= 18
  );
}

/** "12.5" with scale 2 -> "1250". Rejects anything that is not a plain positive decimal. */
export function parseMajor(input: string, assetScale: number): string | null {
  const s = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > assetScale) return null;
  const minor = BigInt(whole + frac.padEnd(assetScale, "0"));
  if (minor <= BigInt(0)) return null;
  return minor.toString();
}

/** "1250" with scale 2 -> "12.50" */
export function toMajorString(value: string, assetScale: number): string {
  if (!DIGITS.test(value)) throw new Error("amount value must be digits");
  if (assetScale === 0) return BigInt(value).toString();
  const padded = value.padStart(assetScale + 1, "0");
  const whole = BigInt(padded.slice(0, -assetScale)).toString();
  return `${whole}.${padded.slice(-assetScale)}`;
}

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** For screens: "NGN 2,050.00" */
export function formatAmount(a: Amount): string {
  const [whole, frac] = toMajorString(a.value, a.assetScale).split(".");
  return `${a.assetCode} ${group(whole)}${frac !== undefined ? "." + frac : ""}`;
}

// [plural, minor plural, singular, minor singular]
const CURRENCY_WORDS: Record<string, [string, string, string, string]> = {
  NGN: ["naira", "kobo", "naira", "kobo"],
  USD: ["dollars", "cents", "dollar", "cent"],
  EUR: ["euros", "cents", "euro", "cent"],
  GBP: ["pounds", "pence", "pound", "penny"],
  ZAR: ["rand", "cents", "rand", "cent"],
  KES: ["shillings", "cents", "shilling", "cent"],
  GHS: ["cedis", "pesewas", "cedi", "pesewa"],
  CAD: ["Canadian dollars", "cents", "Canadian dollar", "cent"],
  MXN: ["pesos", "centavos", "peso", "centavo"],
};

/**
 * The test network has no naira, so dollar amounts also carry a naira figure for Nigerian users:
 * at the CBN official rate of 16 Nov 2026 (NGN 1,353.97 per USD), rounded to the nearest naira.
 * Display only: the money itself moves in dollars.
 */
export const NGN_PER_USD_KOBO = BigInt(135397);
export const NGN_RATE_NOTE = "at the CBN rate of 16 Nov (₦1,353.97 per $1)";
export function nairaOf(a: Amount): string | null {
  if (a.assetCode !== "USD") return null;
  const cents = (BigInt(a.value) * BigInt(100)) / BigInt(10) ** BigInt(a.assetScale);
  const naira = (cents * NGN_PER_USD_KOBO + BigInt(5000)) / BigInt(10000);
  return group(naira.toString());
}

/** For speech: "2,050 naira" or "12 dollars and 50 cents, about 16,925 naira". Never drops a non-zero fraction. */
/** Spoken amounts are short: naira only, once ("about 5,000 naira"). The screen shows dollars as well. */
export function speakAmount(a: Amount): string {
  const n = nairaOf(a);
  return n && n !== "0" ? `about ${n} naira` : speakPlain(a);
}

export function speakPlain(a: Amount): string {
  const [whole, frac] = toMajorString(a.value, a.assetScale).split(".");
  const words = CURRENCY_WORDS[a.assetCode];
  const fracIsZero = !frac || /^0+$/.test(frac);
  if (!words) return `${group(whole)}${fracIsZero ? "" : "." + frac} ${a.assetCode}`;
  const major = whole === "1" ? words[2] : words[0];
  if (fracIsZero) return `${group(whole)} ${major}`;
  const minor = BigInt(frac).toString();
  if (a.assetScale === 2 && whole === "0") return `${minor} ${minor === "1" ? words[3] : words[1]}`;
  if (a.assetScale === 2) return `${group(whole)} ${major} and ${minor} ${minor === "1" ? words[3] : words[1]}`;
  return `${group(whole)}.${frac} ${words[0]}`;
}

export function sameAsset(a: Amount, b: Amount): boolean {
  return a.assetCode === b.assetCode && a.assetScale === b.assetScale;
}

export function addAmounts(a: Amount, b: Amount): Amount {
  if (!sameAsset(a, b)) throw new Error("cannot add amounts in different assets");
  return { ...a, value: (BigInt(a.value) + BigInt(b.value)).toString() };
}

/** What is left of a cap after spending. Never negative. */
export function remainingOfCap(cap: Amount, spent: Amount): Amount {
  if (!sameAsset(cap, spent)) throw new Error("cap and spent are in different assets");
  const left = BigInt(cap.value) - BigInt(spent.value);
  return { ...cap, value: (left > BigInt(0) ? left : BigInt(0)).toString() };
}

export function exceedsCap(cap: Amount, spent: Amount, next: Amount): boolean {
  if (!sameAsset(cap, spent) || !sameAsset(cap, next)) throw new Error("amounts are in different assets");
  return BigInt(spent.value) + BigInt(next.value) > BigInt(cap.value);
}

/**
 * An amount as the customer said it, in the wallet's currency. Naira is the default: "5000",
 * "5,000 naira" and "5k" are naira; "2 dollars", "$2" and "50 cents" are dollars. A naira amount
 * for a dollar wallet is converted at the CBN rate (rounded to the nearest cent). Returns the
 * minor units and, when converted, the naira the customer said (grouped, e.g. "5,000").
 */

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "two thousand five hundred" -> "2500", "a thousand" -> "1000". Leaves digits ("2 thousand") alone. */
export function numberWordsToDigits(text: string): string {
  const words = text.split(/(\s+|-)/);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i].toLowerCase();
    const starts = w in SMALL || w in TENS || (w === "a" && /^(hundred|thousand|million)$/i.test(words[i + 2] ?? ""));
    if (!starts) {
      out.push(words[i]);
      i++;
      continue;
    }
    let total = 0;
    let current = 0;
    let j = i;
    let used = false;
    for (; j < words.length; j++) {
      const x = words[j].toLowerCase();
      if (/^(\s+|-)$/.test(words[j]) || x === "") continue;
      if (x in SMALL) current += SMALL[x];
      else if (x in TENS) current += TENS[x];
      else if (x === "a" && !used) current = 1;
      else if (x === "hundred") current = (current || 1) * 100;
      else if (x === "thousand") (total += (current || 1) * 1000), (current = 0);
      else if (x === "million") (total += (current || 1) * 1_000_000), (current = 0);
      else if (x === "and" && used) continue;
      else break;
      used = true;
    }
    // give back trailing spaces / "and" that did not belong to the number
    let end = j;
    while (end > i && (/^(\s+|-)$/.test(words[end - 1]) || words[end - 1].toLowerCase() === "and")) end--;
    out.push(String(total + current));
    i = end;
  }
  return out.join("");
}

export function amountFromSpeech(text: string, assetCode: string, assetScale: number): { minor: string; saidNaira: string | null } | null {
  const t = numberWordsToDigits(text.toLowerCase().replace(/,/g, ""));
  const m = t.match(/\d+(\.\d+)?/);
  if (!m) return null;
  let num = m[0];
  if (/\d\s*k\b|thousand/.test(t)) num = (Number(num) * 1000).toString();
  if (/million/.test(t)) num = (Number(num) * 1_000_000).toString();
  const dollars = /\$|dollar|usd/.test(t);
  const centsOnly = /cent/.test(t) && !dollars;
  if (assetCode !== "USD") {
    const minor = parseMajor(num, assetScale);
    return minor ? { minor, saidNaira: null } : null;
  }
  const scaleUp = BigInt(10) ** BigInt(Math.max(0, assetScale - 2));
  if (dollars || centsOnly) {
    const minor = centsOnly ? (/^\d+$/.test(num) && BigInt(num) > BigInt(0) ? (BigInt(num) * scaleUp).toString() : null) : parseMajor(num, assetScale);
    return minor ? { minor, saidNaira: null } : null;
  }
  const kobo = parseMajor(num, 2);
  if (!kobo) return null;
  const cents = (BigInt(kobo) * BigInt(100) + NGN_PER_USD_KOBO / BigInt(2)) / NGN_PER_USD_KOBO;
  if (cents <= BigInt(0)) return null;
  const [w, f] = num.split(".");
  return { minor: (cents * scaleUp).toString(), saidNaira: group(w) + (f && !/^0+$/.test(f) ? "." + f : "") };
}
