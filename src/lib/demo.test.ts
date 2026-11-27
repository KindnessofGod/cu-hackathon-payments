import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "./testing/memoryStore";

let mem = new MemoryStore();
vi.mock("./store", () => ({ getStore: () => mem }));
vi.mock("./push", () => ({ alertCustomer: async () => {} }));

import { approveRequest, capSummary, createRequest, customerFromDeviceToken, merchantView, pendingRequest, recentCustomers } from "./domain";
import { demoSellerCookie, demoSellerFromCookie, startDemo } from "./demo";
import { MOCK_HOST } from "./op/mock";
import { issueChallenge } from "./approval";

beforeEach(() => {
  mem = new MemoryStore();
  process.env.APP_SECRET = "test-secret-test-secret-test-secret-1234";
  delete process.env.MOCK_OP; // the deployed app runs on the real rail; the demo must not depend on MOCK_OP
});

describe("one-device demo", () => {
  it("makes a simulated customer with a limit already set and a device token", async () => {
    const { customer, deviceToken } = await startDemo("https://example.test");
    expect(customer.demo).toBe(true);
    expect(customer.wallet.id.startsWith(MOCK_HOST)).toBe(true);
    const cap = capSummary(customer.cap);
    expect(cap?.status).toBe("active");
    expect(cap?.limit.value).toBe("5000000"); // 50,000 naira in kobo
    expect((await customerFromDeviceToken(deviceToken))?.id).toBe(customer.id);
  });
  it("runs a whole payment on the simulated wallet: seller asks, customer approves, seller sees it received", async () => {
    const { customer } = await startDemo("https://example.test");
    const req = await createRequest(customer.payCode, "2000");
    const pending = await pendingRequest(customer);
    expect(pending?.quote?.debitAmount.value).toBe("202000"); // 2,000 naira plus the simulated 1% fee
    const c = issueChallenge({ requestId: pending!.id, quoteId: pending!.quote!.id, debitValue: pending!.quote!.debitAmount.value, assetCode: "NGN", assetScale: 2 });
    expect(c).toBeTruthy();
    const proof = { method: "confirm-button", challenge: pending!.approval!.challenge };
    const done = await approveRequest(customer, req.id, proof, "https://example.test");
    expect(done.request.status).toBe("paid");
    expect((await merchantView(req.id)).status).toBe("received");
  });
  it("a real merchant request to a demo customer still uses the simulated seller", async () => {
    process.env.RECEIVER_WALLET_ADDRESS_URL = "https://ilp.interledger-test.dev/real-seller";
    const { customer } = await startDemo("https://example.test");
    const req = await createRequest(customer.payCode, "500");
    expect(req.merchantWalletId.startsWith(MOCK_HOST)).toBe(true);
    delete process.env.RECEIVER_WALLET_ADDRESS_URL;
  });
  it("demo customers never show in the real seller's recent list", async () => {
    const { customer } = await startDemo("https://example.test");
    await createRequest(customer.payCode, "500");
    expect(await recentCustomers()).toEqual([]);
  });
  it("the demo seller cookie names one customer and cannot be forged", async () => {
    const { customer } = await startDemo("https://example.test");
    const cookie = demoSellerCookie(customer.id);
    expect(await demoSellerFromCookie(cookie)).toBe(customer.id);
    expect(await demoSellerFromCookie(`${customer.id}.forged`)).toBeNull();
    expect(await demoSellerFromCookie(`other.${cookie.split(".")[1]}`)).toBeNull();
    expect(await demoSellerFromCookie(undefined)).toBeNull();
  });
});
