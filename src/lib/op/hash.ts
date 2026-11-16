import { createHash, timingSafeEqual } from "crypto";

/** The interaction hash from the Open Payments docs: sha-256 over four lines, base64 encoded. */
export function interactionHash(clientNonce: string, finishNonce: string, interactRef: string, grantEndpoint: string): string {
  return createHash("sha256").update(`${clientNonce}\n${finishNonce}\n${interactRef}\n${grantEndpoint}`, "ascii").digest("base64");
}

const canon = (h: string) => h.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");

/**
 * True when the hash on the callback matches. The docs do not say whether the grant endpoint
 * carries a trailing slash, so both spellings are accepted.
 */
export function verifyInteractionHash(received: string, clientNonce: string, finishNonce: string, interactRef: string, grantEndpoint: string): boolean {
  const base = grantEndpoint.replace(/\/+$/, "");
  const got = Buffer.from(canon(received));
  return [base, base + "/"].some((endpoint) => {
    const want = Buffer.from(canon(interactionHash(clientNonce, finishNonce, interactRef, endpoint)));
    return want.length === got.length && timingSafeEqual(want, got);
  });
}
