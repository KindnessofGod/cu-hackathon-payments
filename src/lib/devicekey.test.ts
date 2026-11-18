import { generateKeyPairSync, sign } from "crypto";
import { describe, expect, it } from "vitest";
import { spkiFromX963, verifyDeviceSignature } from "./devicekey";

// Stand-in for the iPad's Secure Enclave key: a P-256 key, exported the way iOS exports it (X9.63).
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
const x963 = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64");
const signIt = (msg: string) => sign("sha256", Buffer.from(msg, "utf8"), { key: privateKey, dsaEncoding: "der" }).toString("base64");

describe("device key", () => {
  it("accepts a signature over the exact challenge", () => {
    const spki = spkiFromX963(x963)!;
    expect(spki).toBeTruthy();
    expect(verifyDeviceSignature(spki, "nonce.mac", signIt("nonce.mac"))).toBe(true);
  });
  it("rejects a signature over another challenge, garbage, or a bad key", () => {
    const spki = spkiFromX963(x963)!;
    expect(verifyDeviceSignature(spki, "nonce.other", signIt("nonce.mac"))).toBe(false);
    expect(verifyDeviceSignature(spki, "nonce.mac", "AAAA")).toBe(false);
    expect(verifyDeviceSignature(spki, "nonce.mac", undefined)).toBe(false);
    expect(spkiFromX963(Buffer.alloc(65, 1).toString("base64"))).toBeNull();
  });
});
