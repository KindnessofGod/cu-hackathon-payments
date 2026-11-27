import { MOCK_HOST, MockGateway } from "./mock";
import { RealGateway, realConfigured } from "./real";
import { OpError, type PaymentsGateway, type Role } from "./types";

export * from "./types";

/** True when the app is running against the SIMULATED wallet. Shown as a banner on every screen. */
export function isSimulated(): boolean {
  return process.env.MOCK_OP === "1";
}

const cache: Partial<Record<string, PaymentsGateway>> = {};

/**
 * The merchant app and the wallet app each get their own gateway, signed with their own key.
 * They never share a client.
 */
export function gateway(role: Role): PaymentsGateway {
  const key = `${isSimulated() ? "mock" : "real"}:${role}`;
  if (!cache[key]) {
    if (isSimulated()) cache[key] = new MockGateway();
    else if (realConfigured(role)) cache[key] = new RealGateway(role);
    else throw new OpError("invalid_request", `No keys configured for the ${role} app. Fill in .env, or set MOCK_OP=1 to use the simulated wallet.`);
  }
  return cache[key]!;
}

/** True for the simulated wallet addresses (https://mock-wallet.invalid/<name>). */
export function isMockWallet(walletUrl: string): boolean {
  return walletUrl.startsWith(`${MOCK_HOST}/`) && walletUrl.length > MOCK_HOST.length + 1;
}

let sandbox: MockGateway | undefined;

/**
 * The gateway for one wallet. A simulated wallet address always gets the SIMULATED gateway, even when the
 * app runs on the real rail: that is how the judge demo works with no real wallet and no real money.
 */
export function gatewayFor(role: Role, walletUrl: string | undefined): PaymentsGateway {
  if (walletUrl && isMockWallet(walletUrl)) return (sandbox ??= new MockGateway());
  return gateway(role);
}
