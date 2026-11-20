// Growing money, not only spending it: a savings wallet, and practice investing at live share prices.
// Both move real (test) money with Open Payments, approved by the fingerprint like any payment.
// Investing is PRACTICE: the money goes to a Pay Alone practice wallet and the shares are recorded at
// the live price; no shares are bought. Real investing needs a licensed broker partner.
import { customerHistory, DomainError, prepareOutgoing, type Customer, type PaymentRequest } from "./domain";
import { formatAmount, type Amount } from "./money";

export const WATCH: { symbol: string; name: string; about: string }[] = [
  { symbol: "SPY", name: "S&P 500 fund", about: "a fund that holds the 500 largest US companies" },
  { symbol: "AAPL", name: "Apple", about: "iPhones and computers" },
  { symbol: "MSFT", name: "Microsoft", about: "software and cloud" },
  { symbol: "NVDA", name: "NVIDIA", about: "chips for artificial intelligence" },
  { symbol: "AMZN", name: "Amazon", about: "online shopping and cloud" },
  { symbol: "GOOGL", name: "Google (Alphabet)", about: "search and advertising" },
  { symbol: "TSLA", name: "Tesla", about: "electric cars" },
];

export type MarketQuote = {
  symbol: string;
  name: string;
  about: string;
  priceMinor: string; // US cents
  changeMonthBp: number; // change over about one month, in hundredths of a percent
  asOf: string;
};

let cache: { at: number; quotes: MarketQuote[] } | null = null;

async function fetchOne(w: (typeof WATCH)[number]): Promise<MarketQuote | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${w.symbol}?range=1mo&interval=1d`, {
      headers: { "User-Agent": "Mozilla/5.0 (PayAlone)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = await res.json();
    const r = d?.chart?.result?.[0];
    const price = Number(r?.meta?.regularMarketPrice);
    const closes: number[] = (r?.indicators?.quote?.[0]?.close ?? []).filter((x: unknown) => typeof x === "number");
    if (!Number.isFinite(price) || price <= 0) return null;
    const first = closes[0];
    const change = first ? Math.round(((price - first) / first) * 10000) : 0;
    return {
      ...w,
      priceMinor: String(Math.round(price * 100)),
      changeMonthBp: change,
      asOf: new Date((Number(r?.meta?.regularMarketTime) || Date.now() / 1000) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Live prices from Yahoo Finance's public chart data, cached for a minute. */
export async function market(): Promise<MarketQuote[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.quotes;
  const quotes = (await Promise.all(WATCH.map(fetchOne))).filter((q): q is MarketQuote => Boolean(q));
  if (!quotes.length) throw new DomainError("wrong_state", "Share prices are not available right now.");
  cache = { at: Date.now(), quotes };
  return quotes;
}

export function findShare(said: string) {
  const n = said.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
  return (
    WATCH.find((w) => w.symbol.toLowerCase() === n) ??
    WATCH.find((w) => w.name.toLowerCase().includes(n) || n.includes(w.name.toLowerCase().split(" ")[0])) ??
    (/(s ?& ?p|500|index|fund)/.test(n) ? WATCH[0] : undefined)
  );
}

const savingsUrl = () => process.env.SAVINGS_WALLET_ADDRESS_URL ?? "";
const investUrl = () => process.env.INVEST_WALLET_ADDRESS_URL ?? "";

export async function saveMoney(customer: Customer, amountMajor: string): Promise<PaymentRequest> {
  if (!savingsUrl()) throw new DomainError("wrong_state", "The savings wallet is not set up yet.");
  return prepareOutgoing(customer, savingsUrl(), "your savings", amountMajor, { purpose: "save", description: "Savings, with Pay Alone" });
}

export async function investPractice(customer: Customer, share: string, amountMajor: string): Promise<PaymentRequest> {
  if (!investUrl()) throw new DomainError("wrong_state", "Practice investing is not set up yet.");
  const w = findShare(share);
  if (!w) throw new DomainError("not_found", `I can only invest in: ${WATCH.map((x) => x.name).join(", ")}.`);
  return prepareOutgoing(customer, investUrl(), `practice investment in ${w.name}`, amountMajor, {
    purpose: "invest",
    description: `Practice investment: ${w.symbol}`,
    check: async (a: Amount) => {
      if (a.assetCode !== "USD") throw new DomainError("bad_input", "Practice investing works in US dollars only.");
      const q = (await market()).find((x) => x.symbol === w.symbol);
      if (!q) throw new DomainError("wrong_state", `The price of ${w.name} is not available right now.`);
      const cents = BigInt(a.value) * BigInt(100) / BigInt(10) ** BigInt(a.assetScale); // to cents
      const unitsMicro = ((cents * BigInt(1_000_000)) / BigInt(q.priceMinor)).toString();
      return { invest: { symbol: w.symbol, name: w.name, priceMinor: q.priceMinor, unitsMicro } };
    },
  });
}

const usd = (cents: bigint): Amount => ({ value: cents.toString(), assetCode: "USD", assetScale: 2 });

/** What the customer has saved and invested through Pay Alone (paid payments only), valued at live prices. */
export async function growSummary(customer: Customer) {
  const history = (await customerHistory(customer)).filter((h) => h.status === "paid" && h.purpose);
  const saves = history.filter((x) => x.purpose === "save").map((h) => h.receiveAmount ?? h.requested);
  const saved: Amount | null = saves.length
    ? { ...saves[0], value: saves.reduce((t, a) => t + BigInt(a.value), BigInt(0)).toString() }
    : null;
  let quotes: MarketQuote[] = [];
  try {
    quotes = await market();
  } catch {
    /* prices unavailable: show cost only */
  }
  const by = new Map<string, { symbol: string; name: string; unitsMicro: bigint; costCents: bigint }>();
  for (const h of history.filter((x) => x.purpose === "invest" && x.invest)) {
    const i = h.invest!;
    const a = h.receiveAmount ?? h.requested;
    const cents = (BigInt(a.value) * BigInt(100)) / BigInt(10) ** BigInt(a.assetScale);
    const cur = by.get(i.symbol) ?? { symbol: i.symbol, name: i.name, unitsMicro: BigInt(0), costCents: BigInt(0) };
    cur.unitsMicro += BigInt(i.unitsMicro);
    cur.costCents += cents;
    by.set(i.symbol, cur);
  }
  const holdings = [...by.values()].map((x) => {
    const q = quotes.find((m) => m.symbol === x.symbol);
    const valueCents = q ? (x.unitsMicro * BigInt(q.priceMinor)) / BigInt(1_000_000) : null;
    return {
      symbol: x.symbol,
      name: x.name,
      shares: (Number(x.unitsMicro) / 1e6).toFixed(4),
      cost: usd(x.costCents),
      value: valueCents === null ? null : usd(valueCents),
    };
  });
  return { saved, holdings, market: quotes, savingsReady: Boolean(savingsUrl()), investReady: Boolean(investUrl()) };
}

/** One line for the voice agent. */
export function growText(g: Awaited<ReturnType<typeof growSummary>>): string {
  const parts = [g.saved ? `Saved so far: ${formatAmount(g.saved)}.` : "Nothing saved yet."];
  if (g.holdings.length)
    parts.push(
      "Practice investments: " +
        g.holdings.map((h) => `${h.name}, ${h.shares} shares, cost ${formatAmount(h.cost)}${h.value ? `, worth ${formatAmount(h.value)} now` : ""}`).join("; ") +
        ".",
    );
  return parts.join(" ");
}

export function marketText(quotes: MarketQuote[]): string {
  return quotes
    .map((q) => {
      const p = (Number(q.priceMinor) / 100).toFixed(2);
      const c = (q.changeMonthBp / 100).toFixed(1);
      return `${q.name} (${q.about}): ${p} dollars a share, ${q.changeMonthBp >= 0 ? "up" : "down"} ${c.replace("-", "")} percent over the last month`;
    })
    .join(". ");
}
