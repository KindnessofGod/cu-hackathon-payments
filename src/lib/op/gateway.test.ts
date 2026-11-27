import { afterEach, describe, expect, it } from "vitest";
import { gatewayFor, isMockWallet } from "./index";
import { MOCK_HOST } from "./mock";

afterEach(() => {
  delete process.env.MOCK_OP;
});

describe("per-wallet gateway", () => {
  it("recognises simulated wallet addresses only", () => {
    expect(isMockWallet(`${MOCK_HOST}/ada`)).toBe(true);
    expect(isMockWallet(`${MOCK_HOST}/`)).toBe(false);
    expect(isMockWallet("https://ilp.interledger-test.dev/ada")).toBe(false);
    expect(isMockWallet("https://mock-wallet.invalid.evil.com/ada")).toBe(false);
  });
  it("uses the simulated gateway for a simulated wallet even when the app runs on the real rail", () => {
    delete process.env.MOCK_OP;
    expect(gatewayFor("wallet", `${MOCK_HOST}/ada`).simulated).toBe(true);
    expect(gatewayFor("merchant", `${MOCK_HOST}/mama-chidi-shop`).simulated).toBe(true);
  });
});
