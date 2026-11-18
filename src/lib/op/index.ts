import { MockGateway } from "./mock";
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
