import { describe, expect, it } from "vitest";
import { makeInterval, periodEnd, periodKey } from "./interval";

describe("intervals", () => {
  const start = new Date("2026-11-16T00:00:00.000Z");
  it("builds the ISO 8601 repeating form", () => {
    expect(makeInterval("week", start)).toBe("R/2026-11-16T00:00:00Z/P1W");
    expect(makeInterval("day", start)).toBe("R/2026-11-16T00:00:00Z/P1D");
  });
  it("moves to a new period when the interval rolls over, so spending resets", () => {
    const i = makeInterval("week", start);
    expect(periodKey(i, Date.parse("2026-11-18T10:00:00Z"))).toBe("0");
    expect(periodKey(i, Date.parse("2026-11-22T23:59:59Z"))).toBe("0");
    expect(periodKey(i, Date.parse("2026-11-23T00:00:00Z"))).toBe("1");
    expect(periodEnd(i, Date.parse("2026-11-18T10:00:00Z"))).toBe("2026-11-23T00:00:00.000Z");
  });
  it("treats a grant without an interval as a single use", () => {
    expect(periodKey(undefined, Date.now())).toBe("once");
  });
});
