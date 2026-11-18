// Fingerprint approval with a WebAuthn passkey. On an iPad Air 3 this is Touch ID on the Home button.
//
// The biometric never leaves the device. The device signs a challenge, and our server checks the
// signature against the public key saved when the fingerprint was set up. The challenge is the
// approval challenge from approval.ts, which is bound to one request, one quote and one amount, so a
// fingerprint approval for one payment cannot be replayed for another.
import {
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { randomToken } from "./secret";

export interface StoredPasskey {
  id: string; // base64url credential id (public)
  publicKey: string; // base64url
  counter: number;
  transports?: string[];
  createdAt: string;
}

export interface PendingRegistration {
  challenge: string;
  expiresAt: string;
}

const TIMEOUT_MS = 2 * 60_000;

export function relyingParty(baseUrl: string) {
  const u = new URL(baseUrl);
  return { rpID: u.hostname, origin: u.origin };
}

/** The bytes the device signs for a payment approval: the approval challenge itself, as UTF-8. */
export function approvalChallengeForDevice(approvalChallenge: string): string {
  return Buffer.from(approvalChallenge, "utf8").toString("base64url");
}

export async function registrationOptions(args: {
  baseUrl: string;
  userId: string;
  userName: string;
  existing: StoredPasskey[];
}): Promise<{ options: Awaited<ReturnType<typeof generateRegistrationOptions>>; pending: PendingRegistration }> {
  const { rpID } = relyingParty(args.baseUrl);
  const options = await generateRegistrationOptions({
    rpName: "Pay Alone",
    rpID,
    userName: args.userName,
    userDisplayName: args.userName,
    userID: new Uint8Array(Buffer.from(args.userId, "utf8")),
    challenge: randomToken(32),
    attestationType: "none",
    timeout: TIMEOUT_MS,
    excludeCredentials: args.existing.map((p) => ({ id: p.id, transports: p.transports })),
    // The device's own unlock (Touch ID on the iPad Air 3), not a separate security key.
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
  });
  return { options, pending: { challenge: options.challenge, expiresAt: new Date(Date.now() + TIMEOUT_MS).toISOString() } };
}

export async function finishRegistration(args: {
  baseUrl: string;
  pending: PendingRegistration | undefined;
  response: unknown;
}): Promise<StoredPasskey | null> {
  if (!args.pending || Date.parse(args.pending.expiresAt) < Date.now()) return null;
  const { rpID, origin } = relyingParty(args.baseUrl);
  try {
    const v = await verifyRegistrationResponse({
      response: args.response as RegistrationResponseJSON,
      expectedChallenge: args.pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!v.verified) return null;
    const c = v.registrationInfo.credential;
    return {
      id: c.id,
      publicKey: Buffer.from(c.publicKey).toString("base64url"),
      counter: c.counter,
      transports: c.transports,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** True only if one of this customer's passkeys signed exactly this approval challenge, with the finger checked. */
export async function verifyPasskeySignature(args: {
  baseUrl: string;
  approvalChallenge: string;
  passkeys: StoredPasskey[];
  response: unknown;
}): Promise<{ ok: boolean; passkeyId?: string; newCounter?: number }> {
  const r = args.response as AuthenticationResponseJSON | undefined;
  const stored = r && typeof r === "object" ? args.passkeys.find((p) => p.id === r.id) : undefined;
  if (!r || !stored) return { ok: false };
  const { rpID, origin } = relyingParty(args.baseUrl);
  try {
    const v = await verifyAuthenticationResponse({
      response: r,
      expectedChallenge: approvalChallengeForDevice(args.approvalChallenge),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
    return v.verified && v.authenticationInfo.userVerified ? { ok: true, passkeyId: stored.id, newCounter: v.authenticationInfo.newCounter } : { ok: false };
  } catch {
    return { ok: false };
  }
}
