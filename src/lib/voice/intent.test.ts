import { describe, expect, it } from "vitest";
import { intentOf } from "./intent";

describe("intentOf", () => {
  it("hears pay and no in English", () => {
    expect(intentOf("Pay.", "en")).toBe("pay");
    expect(intentOf("Yes, please.", "en")).toBe("pay");
    expect(intentOf("No.", "en")).toBe("refuse");
  });
  it("treats a sentence with both as unclear, so nothing happens", () => {
    expect(intentOf("Don't pay", "en")).toBe("unclear");
    expect(intentOf("No, pay", "en")).toBe("unclear");
  });
  it("is unclear on silence or other words", () => {
    expect(intentOf("", "en")).toBe("unclear");
    expect(intentOf("What is the weather", "en")).toBe("unclear");
    expect(intentOf("payment", "en")).toBe("unclear");
  });
  it("ignores tone marks and accents", () => {
    expect(intentOf("Bẹ́ẹ̀ ni", "yo")).toBe("pay");
    expect(intentOf("Rárá", "yo")).toBe("refuse");
    expect(intentOf("Kwụọ", "ig")).toBe("pay");
    expect(intentOf("Mba!", "ig")).toBe("refuse");
    expect(intentOf("A'a", "ha")).toBe("refuse");
    expect(intentOf("Biya", "ha")).toBe("pay");
    expect(intentOf("Oya pay am", "pcm")).toBe("pay");
  });
  it("accepts English words inside another language", () => {
    expect(intentOf("pay", "ig")).toBe("pay");
    expect(intentOf("no", "yo")).toBe("refuse");
  });
});
