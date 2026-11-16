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

const CURRENCY_WORDS: Record<string, [string, string]> = {
  NGN: ["naira", "kobo"],
  USD: ["dollars", "cents"],
  EUR: ["euros", "cents"],
  GBP: ["pounds", "pence"],
  ZAR: ["rand", "cents"],
  KES: ["shillings", "cents"],
  GHS: ["cedis", "pesewas"],
  CAD: ["Canadian dollars", "cents"],
  MXN: ["pesos", "centavos"],
};

/** For speech: "2,050 naira" or "12 dollars and 50 cents". Never drops a non-zero fraction. */
export function speakAmount(a: Amount): string {
  const [whole, frac] = toMajorString(a.value, a.assetScale).split(".");
  const words = CURRENCY_WORDS[a.assetCode];
  const fracIsZero = !frac || /^0+$/.test(frac);
  if (!words) return `${group(whole)}${fracIsZero ? "" : "." + frac} ${a.assetCode}`;
  if (fracIsZero) return `${group(whole)} ${words[0]}`;
  if (a.assetScale === 2) return `${group(whole)} ${words[0]} and ${BigInt(frac).toString()} ${words[1]}`;
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
