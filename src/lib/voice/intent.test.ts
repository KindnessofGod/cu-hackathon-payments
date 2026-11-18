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
    expect(intentOf("A new person you have never paid called Mama Chris is asking for one dollar.", "en")).toBe("unclear");
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
  it("hears questions, which only make the app answer", () => {
    expect(intentOf("Who is this?", "en")).toBe("who");
    expect(intentOf("How much is left?", "en")).toBe("left");
    expect(intentOf("What is my balance", "en")).toBe("left");
    expect(intentOf("Say that again", "en")).toBe("repeat");
    expect(intentOf("What?", "en")).toBe("repeat");
    expect(intentOf("Help", "en")).toBe("help");
    expect(intentOf("Na who?", "pcm")).toBe("who");
    expect(intentOf("How much remain?", "pcm")).toBe("left");
    expect(intentOf("Ta ni?", "yo")).toBe("who");
    expect(intentOf("Èló ló kù?", "yo")).toBe("left");
    expect(intentOf("Onye bụ ya?", "ig")).toBe("who");
    expect(intentOf("Kwuo ya ọzọ", "ig")).toBe("repeat");
    expect(intentOf("Wanene?", "ha")).toBe("who");
    expect(intentOf("Nawa ya rage?", "ha")).toBe("left");
  });
  it("lets a question win over no, since a question changes nothing", () => {
    expect(intentOf("No wait, who is it?", "en")).toBe("who");
  });
});
