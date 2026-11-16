// Approval of ONE payment. A payment cannot be created without a proof for that exact quote and amount.
//
// Today the proof comes from a confirm action on the screen ("confirm-button").
// Planned: a WebAuthn passkey (fingerprint) that signs the same challenge. Only `verify` changes then.
import { randomToken, sign } from "./secret";

export interface ApprovalChallenge {
  challenge: string; // bound to request id, quote id and debit amount
  expiresAt: string;
}

export interface ApprovalProof {
  method: "confirm-button";
  challenge: string;
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

/** True only if the proof was issued for this exact request, quote and amount and has not expired. */
export function verifyApproval(subject: ApprovalSubject, issued: ApprovalChallenge | undefined, proof: unknown, now = Date.now()): boolean {
  if (!issued || !proof || typeof proof !== "object") return false;
  const p = proof as Partial<ApprovalProof>;
  if (p.method !== "confirm-button" || typeof p.challenge !== "string") return false;
  if (p.challenge !== issued.challenge) return false;
  if (Date.parse(issued.expiresAt) < now) return false;
  const [nonce, mac] = issued.challenge.split(".");
  return Boolean(nonce && mac) && mac === binding(subject, nonce, issued.expiresAt);
}
