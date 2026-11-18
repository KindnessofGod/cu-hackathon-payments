// Repeating spending intervals in the ISO 8601 form Open Payments uses: R/<start>/P1W

export type Every = "day" | "week";

export function makeInterval(every: Every, start: Date): string {
  return `R/${start.toISOString().replace(/\.\d{3}Z$/, "Z")}/${every === "day" ? "P1D" : "P1W"}`;
}

/** Which repetition of the interval "now" falls in. Supports PnD and PnW; anything else is one endless period. */
export function periodKey(interval: string | undefined, now: number): string {
  if (!interval) return "once";
  const m = /^R\d*\/([^/]+)\/P(\d+)([DW])$/.exec(interval);
  if (!m) return "single";
  const start = Date.parse(m[1]);
  const days = Number(m[2]) * (m[3] === "W" ? 7 : 1);
  if (Number.isNaN(start) || days <= 0 || now < start) return "single";
  return String(Math.floor((now - start) / (days * 86_400_000)));
}

/** When the current period ends, or null if it cannot be worked out. */
export function periodEnd(interval: string | undefined, now: number): string | null {
  const m = interval ? /^R\d*\/([^/]+)\/P(\d+)([DW])$/.exec(interval) : null;
  if (!m) return null;
  const start = Date.parse(m[1]);
  const len = Number(m[2]) * (m[3] === "W" ? 7 : 1) * 86_400_000;
  if (Number.isNaN(start) || len <= 0 || now < start) return null;
  return new Date(start + (Math.floor((now - start) / len) + 1) * len).toISOString();
}
