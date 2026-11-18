// Approval of ONE payment. A payment cannot be created without a proof for that exact quote and amount.
//
// Two kinds of proof:
//   "passkey"         the device's fingerprint (Touch ID) signs the challenge via a website passkey.
//   "device-key"      the native iPad app's Secure Enclave key signs it after Touch ID (see devicekey.ts).
//   One of these two is required once the customer has set up a fingerprint.
//   "confirm-button"  a second tap on the screen. Only accepted while no fingerprint is set up.
import { randomToken, sign } from "./secret";

export interface ApprovalChallenge {
  challenge: string; // bound to request id, quote id and debit amount
  expiresAt: string;
}

export interface ApprovalProof {
  method: "confirm-button" | "passkey" | "device-key";
  challenge: string;
  response?: unknown; // WebAuthn assertion, for "passkey"
}

export interface ApprovalSubject {
  requestId: string;
  quoteId: string;
  debitValue: string;
  assetCode: string;
  assetScale: number;
}

const TTL_MS = 3 * 60_000;

function binding(s: ApprovalSubject, nonce: string, expiresAt: string): string {
  return sign([s.requestId, s.quoteId, s.debitValue, s.assetCode, s.assetScale, nonce, expiresAt].join("|"));
}

export function issueChallenge(subject: ApprovalSubject, now = Date.now()): ApprovalChallenge {
  const nonce = randomToken(12);
  const expiresAt = new Date(now + TTL_MS).toISOString();
  return { challenge: `${nonce}.${binding(subject, nonce, expiresAt)}`, expiresAt };
}

/** True only if the challenge was issued for this exact request, quote and amount and has not expired. */
export function challengeIsValid(subject: ApprovalSubject, issued: ApprovalChallenge | undefined, challenge: unknown, now = Date.now()): boolean {
  if (!issued || typeof challenge !== "string" || challenge !== issued.challenge) return false;
  if (Date.parse(issued.expiresAt) < now) return false;
  const [nonce, mac] = issued.challenge.split(".");
  return Boolean(nonce && mac) && mac === binding(subject, nonce, issued.expiresAt);
}

/** The on-screen confirm proof. The fingerprint proof is checked in passkey.ts on top of challengeIsValid. */
export function verifyApproval(subject: ApprovalSubject, issued: ApprovalChallenge | undefined, proof: unknown, now = Date.now()): boolean {
  if (!proof || typeof proof !== "object") return false;
  const p = proof as Partial<ApprovalProof>;
  return p.method === "confirm-button" && challengeIsValid(subject, issued, p.challenge, now);
}
