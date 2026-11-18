// Bridge to the native iPad app (ios/). When the site runs inside it, fingerprint checks use the
// iPad's own Touch ID prompt through a Secure Enclave key instead of the website passkey sheet.

interface Bridge {
  postMessage(msg: unknown): Promise<unknown>;
}

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { webkit?: { messageHandlers?: { payalone?: Bridge } } };
  return w.webkit?.messageHandlers?.payalone ?? null;
}

export function inNativeApp(): boolean {
  return bridge() !== null;
}

/** Creates a new key in the Secure Enclave. Returns the public key (base64 X9.63). */
export async function nativeCreateKey(): Promise<string> {
  return String(await bridge()!.postMessage({ action: "createKey" }));
}

/** Shows the Touch ID prompt and signs the text. Returns a base64 DER signature. Rejects if cancelled. */
export async function nativeSign(text: string, reason: string): Promise<string> {
  return String(await bridge()!.postMessage({ action: "sign", challenge: text, reason }));
}
