import { createPrivateKey, generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";
import { loadPrivateKey } from "./real";

const { privateKey } = generateKeyPairSync("ed25519");
const full = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const middle = full.split("\n")[1];
const same = (k: string | Buffer) => createPrivateKey(k).export({ format: "pem", type: "pkcs8" }).toString() === full;

describe("loadPrivateKey", () => {
  it("accepts every shape the key file gets pasted in", () => {
    expect(same(loadPrivateKey(full))).toBe(true);
    expect(same(loadPrivateKey(full.replace(/\n/g, " ")))).toBe(true);
    expect(same(loadPrivateKey(full.replace(/\n/g, "\\n")))).toBe(true);
    expect(same(loadPrivateKey(middle))).toBe(true);
    expect(same(loadPrivateKey(`  ${middle}\n`))).toBe(true);
    expect(same(loadPrivateKey(Buffer.from(full).toString("base64")))).toBe(true);
  });
  it("rejects text that is not a key", () => {
    expect(() => loadPrivateKey("hello world")).toThrow();
  });
});
