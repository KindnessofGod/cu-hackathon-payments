// Growing money, not only spending it: a savings wallet, and practice investing at live share prices.
// Both move real (test) money with Open Payments, approved by the fingerprint like any payment.
// Investing is PRACTICE: the money goes to a Pay Alone practice wallet and the shares are recorded at
// the live price; no shares are bought. Real investing needs a licensed broker partner.
import { customerHistory, DomainError, prepareOutgoing, type Customer, type PaymentRequest } from "./domain";
import { formatAmount, NGN_PER_USD_KOBO, type Amount } from "./money";

type Watch = { symbol: string; name: string; about: string; market: "NGX" | "US" };
export const WATCH: Watch[] = [
  { symbol: "DANGCEM", name: "Dangote Cement", about: "cement, Nigeria's biggest listed company", market: "NGX" },
  { symbol: "MTNN", name: "MTN Nigeria", about: "phone calls and data", market: "NGX" },
  { symbol: "AIRTELAFRI", name: "Airtel Africa", about: "phone calls and data across Africa", market: "NGX" },
  { symbol: "ZENITHBANK", name: "Zenith Bank", about: "banking", market: "NGX" },
  { symbol: "GTCO", name: "GTCO (GTBank)", about: "banking", market: "NGX" },
  { symbol: "BUAFOODS", name: "BUA Foods", about: "flour, sugar and pasta", market: "NGX" },
  { symbol: "NESTLE", name: "Nestle Nigeria", about: "Milo, Maggi and food", market: "NGX" },
  { symbol: "SEPLAT", name: "Seplat Energy", about: "oil and gas", market: "NGX" },
  { symbol: "SPY", name: "S&P 500 fund", about: "a US fund that holds the 500 largest US companies", market: "US" },
  { symbol: "AAPL", name: "Apple", about: "iPhones and computers", market: "US" },
  { symbol: "MSFT", name: "Microsoft", about: "software and cloud", market: "US" },
  { symbol: "NVDA", name: "NVIDIA", about: "chips for artificial intelligence", market: "US" },
];

export type MarketQuote = {
  symbol: string;
  name: string;
  about: string;
  market: "NGX" | "US";
  currency: "NGN" | "USD";
  priceMinor: string; // kobo or cents
  changeMonthBp: number | null; // change over about one month, in hundredths of a percent
  asOf: string;
  source: string;
};

let cache: { at: number; quotes: MarketQuote[] } | null = null;
const UA = { "User-Agent": "Mozilla/5.0 (PayAlone)" };
const toMinor = (n: number) => String(Math.round(n * 100));

async function fetchUs(w: Watch): Promise<MarketQuote | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${w.symbol}?range=1mo&interval=1d`, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;
    const r = (await res.json())?.chart?.result?.[0];
    const price = Number(r?.meta?.regularMarketPrice);
    const closes: number[] = (r?.indicators?.quote?.[0]?.close ?? []).filter((x: unknown) => typeof x === "number");
    if (!Number.isFinite(price) || price <= 0) return null;
    const first = closes[0];
    return {
      ...w,
      currency: "USD",
      priceMinor: toMinor(price),
      changeMonthBp: first ? Math.round(((price - first) / first) * 10000) : null,
      asOf: new Date((Number(r?.meta?.regularMarketTime) || Date.now() / 1000) * 1000).toISOString(),
      source: "Yahoo Finance, delayed",
    };
  } catch {
    return null;
  }
}

/** Nigerian Exchange: official daily prices from NGX, and the one-month change from TradingView's public scanner. */
async function fetchNgx(list: Watch[]): Promise<MarketQuote[]> {
  try {
    const [ngx, tv] = await Promise.all([
      fetch("https://doclib.ngxgroup.com/REST/api/statistics/equities/?market=&sector=&orderby=&pageSize=400&pageNo=0", { headers: UA, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch("https://scanner.tradingview.com/nigeria/scan", {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: { tickers: list.map((w) => `NSENG:${w.symbol}`) }, columns: ["name", "close", "Perf.1M"] }),
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .catch(() => ({ data: [] })),
    ]);
    const rows = Array.isArray(ngx) ? (ngx as { Symbol: string; ClosePrice: number; TradeDate: string }[]) : [];
    const perf = new Map<string, { close: number; m: number | null }>();
    for (const x of (tv?.data ?? []) as { d: [string, number, number | null] }[]) perf.set(String(x.d[0]), { close: Number(x.d[1]), m: x.d[2] });
    const out: MarketQuote[] = [];
    for (const w of list) {
      const row = rows.find((r) => String(r.Symbol).trim() === w.symbol);
      const p = perf.get(w.symbol);
      const price = row ? Number(row.ClosePrice) : p?.close;
      if (!price || !Number.isFinite(price)) continue;
      out.push({
        ...w,
        currency: "NGN",
        priceMinor: toMinor(price),
        changeMonthBp: typeof p?.m === "number" ? Math.round(p.m * 100) : null,
        asOf: row?.TradeDate ? new Date(row.TradeDate).toISOString() : new Date().toISOString(),
        source: row ? "Nigerian Exchange (NGX) daily price" : "TradingView (NGX), delayed",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Live prices, cached for a minute. Nigerian shares first. */
export async function market(): Promise<MarketQuote[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.quotes;
  const [ng, us] = await Promise.all([fetchNgx(WATCH.filter((w) => w.market === "NGX")), Promise.all(WATCH.filter((w) => w.market === "US").map(fetchUs))]);
  const quotes = [...ng, ...us.filter((q): q is MarketQuote => Boolean(q))];
  if (!quotes.length) throw new DomainError("wrong_state", "Share prices are not available right now.");
  cache = { at: Date.now(), quotes };
  return quotes;
}

export function findShare(said: string) {
  const n = said.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
  return (
    WATCH.find((w) => w.symbol.toLowerCase() === n) ??
    WATCH.find((w) => w.name.toLowerCase().includes(n) || n.includes(w.name.toLowerCase().split(" ")[0])) ??
    (/gt ?bank|guaranty/.test(n) ? WATCH.find((w) => w.symbol === "GTCO") : undefined) ??
    (/dangote/.test(n) ? WATCH.find((w) => w.symbol === "DANGCEM") : undefined) ??
    (/(s ?& ?p|500|index|fund)/.test(n) ? WATCH.find((w) => w.symbol === "SPY") : undefined)
  );
}

const savingsUrl = () => process.env.SAVINGS_WALLET_ADDRESS_URL ?? "";
const investUrl = () => process.env.INVEST_WALLET_ADDRESS_URL ?? "";

export async function saveMoney(customer: Customer, amountMajor: string): Promise<PaymentRequest & { saidNaira?: string }> {
  if (!savingsUrl()) throw new DomainError("wrong_state", "The savings wallet is not set up yet.");
  return prepareOutgoing(customer, savingsUrl(), "your savings", amountMajor, { purpose: "save", description: "Savings, with Pay Alone" });
}

export async function investPractice(customer: Customer, share: string, amountMajor: string): Promise<PaymentRequest & { saidNaira?: string }> {
  if (!investUrl()) throw new DomainError("wrong_state", "Practice investing is not set up yet.");
  const w = findShare(share);
  if (!w) throw new DomainError("not_found", `I can only invest in: ${WATCH.map((x) => x.name).join(", ")}.`);
  return prepareOutgoing(customer, investUrl(), `practice investment in ${w.name}`, amountMajor, {
    purpose: "invest",
    description: `Practice investment: ${w.symbol}`,
    check: async (a: Amount) => {
      if (a.assetCode !== "USD") throw new DomainError("bad_input", "Practice investing works from a US dollar wallet only.");
      const q = (await market()).find((x) => x.symbol === w.symbol);
      if (!q) throw new DomainError("wrong_state", `The price of ${w.name} is not available right now.`);
      const cents = (BigInt(a.value) * BigInt(100)) / BigInt(10) ** BigInt(a.assetScale);
      // Nigerian shares are priced in naira: the dollars are counted in naira at the CBN rate shown in the app.
      const inQuoteMinor = q.currency === "NGN" ? (cents * NGN_PER_USD_KOBO) / BigInt(100) : cents;
      const unitsMicro = ((inQuoteMinor * BigInt(1_000_000)) / BigInt(q.priceMinor)).toString();
      return { invest: { symbol: w.symbol, name: w.name, priceMinor: q.priceMinor, unitsMicro, currency: q.currency } };
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
    const valueMinor = q ? (x.unitsMicro * BigInt(q.priceMinor)) / BigInt(1_000_000) : null;
    return {
      symbol: x.symbol,
      name: x.name,
      shares: (Number(x.unitsMicro) / 1e6).toFixed(4),
      cost: usd(x.costCents),
      value: valueMinor === null || !q ? null : ({ value: valueMinor.toString(), assetCode: q.currency, assetScale: 2 } as Amount),
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
      const p = (Number(q.priceMinor) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
      const unit = q.currency === "NGN" ? "naira" : "dollars";
      const m = q.changeMonthBp === null ? "" : `, ${q.changeMonthBp >= 0 ? "up" : "down"} ${Math.abs(q.changeMonthBp / 100).toFixed(1)} percent over the last month`;
      return `${q.name} (${q.about}, ${q.market === "NGX" ? "Nigerian Exchange" : "US market"}): ${p} ${unit} a share${m}`;
    })
    .join(". ");
}
