import { describe, expect, it } from "vitest";
import { intentOf } from "./intent";

describe("intentOf", () => {
  it("hears pay and no in English", () => {
    expect(intentOf("Pay.", "en")).toBe("pay");
    expect(intentOf("Yes, please.", "en")).toBe("pay");
    expect(intentOf("No.", "en")).toBe("refuse");
  });
  it("treats any no word as a refusal, since refusing moves no money", () => {
    expect(intentOf("No, pay", "en")).toBe("refuse");
    expect(intentOf("yes no", "en")).toBe("refuse");
  });
  it("hears a negative that contains the word pay as a refusal", () => {
    expect(intentOf("Don't pay", "en")).toBe("refuse");
    expect(intentOf("No pay am", "pcm")).toBe("refuse");
    expect(intentOf("Má san", "yo")).toBe("refuse");
    expect(intentOf("Kada ka biya", "ha")).toBe("refuse");
    expect(intentOf("ba a biya ba", "ha")).toBe("refuse");
  });
  it("ignores long sentences, such as the app's own voice heard by the microphone", () => {
    // Real transcripts from the live test of the app's own sentences (17 Nov).
    expect(intentOf("New person wey you never pay before. Mama Chris, they ask for one dollar.", "pcm")).toBe("unclear");
    expect(intentOf("sabon mutum da ba ka taɓa biya ba mama chris yana neman dala ɗaya", "ha")).toBe("unclear");
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
