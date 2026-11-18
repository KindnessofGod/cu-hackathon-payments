// Seals grant tokens before they are stored, and signs approval challenges. Server-side only.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

function key(): Buffer {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return createHash("sha256").update(s).digest();
  if (process.env.MOCK_OP === "1") return createHash("sha256").update("simulated-mode-only-not-a-secret").digest();
  throw new Error("APP_SECRET must be set to at least 32 random characters when using a real wallet.");
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function open(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("base64url");
}

export function sign(text: string): string {
  return createHmac("sha256", key()).update(text).digest("base64url");
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
