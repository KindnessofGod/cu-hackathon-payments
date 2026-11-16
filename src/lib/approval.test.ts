import { beforeAll, describe, expect, it } from "vitest";
import { issueChallenge, verifyApproval } from "./approval";

beforeAll(() => {
  process.env.APP_SECRET = "test-secret-test-secret-test-secret-1234";
});

const subject = { requestId: "r1", quoteId: "q1", debitValue: "205000", assetCode: "NGN", assetScale: 2 };

describe("approval", () => {
  it("accepts a proof for the same request, quote and amount", () => {
    const c = issueChallenge(subject);
    expect(verifyApproval(subject, c, { method: "confirm-button", challenge: c.challenge })).toBe(true);
  });
  it("rejects a proof reused for another quote or another amount", () => {
    const c = issueChallenge(subject);
    const proof = { method: "confirm-button", challenge: c.challenge };
    expect(verifyApproval({ ...subject, quoteId: "q2" }, c, proof)).toBe(false);
    expect(verifyApproval({ ...subject, debitValue: "999999" }, c, proof)).toBe(false);
    expect(verifyApproval({ ...subject, requestId: "r2" }, c, proof)).toBe(false);
  });
  it("rejects a missing, wrong or expired proof", () => {
    const c = issueChallenge(subject, Date.now() - 10 * 60_000);
    expect(verifyApproval(subject, c, { method: "confirm-button", challenge: c.challenge })).toBe(false);
    const fresh = issueChallenge(subject);
    expect(verifyApproval(subject, fresh, undefined)).toBe(false);
    expect(verifyApproval(subject, fresh, { method: "confirm-button", challenge: "made-up" })).toBe(false);
    expect(verifyApproval(subject, undefined, { method: "confirm-button", challenge: fresh.challenge })).toBe(false);
  });
});
