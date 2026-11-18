// Fingerprint approval inside the native iPad app (ios/). The app keeps a P-256 key in the iPad's
// Secure Enclave, usable only after Touch ID (biometryCurrentSet). Each payment, the app signs that
// request's approval challenge; this file checks the signature against the public key saved at setup.
// Same security idea as a passkey, without the website passkey sheet.
import { createPublicKey, verify } from "crypto";

export interface StoredDeviceKey {
  id: string;
  spki: string; // base64 DER SubjectPublicKeyInfo
  createdAt: string;
}

// DER prefix that turns a raw uncompressed P-256 point (65 bytes, 0x04|X|Y) into SubjectPublicKeyInfo.
const P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");

export function spkiFromX963(base64: string): string | null {
  const raw = Buffer.from(base64, "base64");
  if (raw.length !== 65 || raw[0] !== 0x04) return null;
  const spki = Buffer.concat([P256_SPKI_PREFIX, raw]);
  try {
    createPublicKey({ key: spki, format: "der", type: "spki" });
  } catch {
    return null;
  }
  return spki.toString("base64");
}

/** True if `signature` (base64 DER ECDSA over SHA-256) signs `message` (UTF-8) with this key. */
export function verifyDeviceSignature(spki: string, message: string, signature: unknown): boolean {
  if (typeof signature !== "string" || signature.length === 0 || signature.length > 200) return false;
  try {
    const key = createPublicKey({ key: Buffer.from(spki, "base64"), format: "der", type: "spki" });
    return verify("sha256", Buffer.from(message, "utf8"), { key, dsaEncoding: "der" }, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
