import { describe, expect, it } from "vitest";
import { addAmounts, exceedsCap, formatAmount, isAmount, parseMajor, remainingOfCap, speakAmount, toMajorString, amountFromSpeech } from "./money";

const ngn = (value: string) => ({ value, assetCode: "NGN", assetScale: 2 });

describe("parseMajor", () => {
  it("converts major units to minor units without floats", () => {
    expect(parseMajor("2000", 2)).toBe("200000");
    expect(parseMajor("12.5", 2)).toBe("1250");
    expect(parseMajor("0.01", 2)).toBe("1");
    expect(parseMajor("1,000.10", 2)).toBe("100010");
    expect(parseMajor("7", 0)).toBe("7");
  });
  it("keeps precision on values a float would corrupt", () => {
    expect(parseMajor("0.29", 2)).toBe("29");
    expect(parseMajor("90071992547409.93", 2)).toBe("9007199254740993");
  });
  it("rejects bad input", () => {
    for (const bad of ["", "abc", "-5", "1.234", "0", "0.00", "1e3", "1.", ".5"]) expect(parseMajor(bad, 2)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats for screens", () => {
    expect(toMajorString("5", 2)).toBe("0.05");
    expect(formatAmount(ngn("205000"))).toBe("NGN 2,050.00");
    expect(formatAmount({ value: "1234567", assetCode: "JPY", assetScale: 0 })).toBe("JPY 1,234,567");
  });
  it("formats for speech and never drops a non-zero fraction", () => {
    expect(speakAmount(ngn("200000"))).toBe("2,000 naira");
    expect(speakAmount(ngn("205050"))).toBe("2,050 naira and 50 kobo");
    expect(speakAmount({ value: "1250", assetCode: "XYZ", assetScale: 2 })).toBe("12.50 XYZ");
    expect(speakAmount({ value: "100", assetCode: "USD", assetScale: 2 })).toBe("about 1,354 naira");
    expect(speakAmount({ value: "101", assetCode: "USD", assetScale: 2 })).toBe("about 1,368 naira");
    expect(speakAmount({ value: "50", assetCode: "USD", assetScale: 2 })).toBe("about 677 naira");
  });
});

describe("cap arithmetic", () => {
  it("adds, subtracts and compares in minor units", () => {
    expect(addAmounts(ngn("100"), ngn("250")).value).toBe("350");
    expect(remainingOfCap(ngn("2000000"), ngn("500000")).value).toBe("1500000");
    expect(remainingOfCap(ngn("100"), ngn("500")).value).toBe("0");
    expect(exceedsCap(ngn("1000"), ngn("600"), ngn("400"))).toBe(false);
    expect(exceedsCap(ngn("1000"), ngn("600"), ngn("401"))).toBe(true);
  });
  it("refuses to mix assets", () => {
    expect(() => addAmounts(ngn("1"), { value: "1", assetCode: "USD", assetScale: 2 })).toThrow();
  });
});

describe("isAmount", () => {
  it("accepts only digit strings with a code and integer scale", () => {
    expect(isAmount(ngn("10"))).toBe(true);
    expect(isAmount({ value: "1.5", assetCode: "NGN", assetScale: 2 })).toBe(false);
    expect(isAmount({ value: 10, assetCode: "NGN", assetScale: 2 })).toBe(false);
    expect(isAmount(null)).toBe(false);
  });
});

describe("amountFromSpeech (naira by default)", () => {
  const f = (t: string) => amountFromSpeech(t, "USD", 2);
  it("treats a bare number as naira and converts at the CBN rate", () => {
    expect(f("5000")).toEqual({ minor: "369", saidNaira: "5,000" });
    expect(f("5,000 naira")).toEqual({ minor: "369", saidNaira: "5,000" });
    expect(f("5k")).toEqual({ minor: "369", saidNaira: "5,000" });
    expect(f("2 thousand")).toEqual({ minor: "148", saidNaira: "2,000" });
  });
  it("keeps dollars when they say dollars", () => {
    expect(f("2 dollars")).toEqual({ minor: "200", saidNaira: null });
    expect(f("$2.50")).toEqual({ minor: "250", saidNaira: null });
    expect(f("50 cents")).toEqual({ minor: "50", saidNaira: null });
  });
  it("refuses nothing or zero", () => {
    expect(f("")).toBeNull();
    expect(f("0")).toBeNull();
    expect(f("1 naira")).toBeNull(); // less than one cent
  });
});
