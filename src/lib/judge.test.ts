import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "./testing/memoryStore";

let mem = new MemoryStore();
vi.mock("./store", () => ({ getStore: () => mem }));

import { createJudgeRequest, decideJudge, decisionSig, judgeCookie, judgeFromCookie, judgeStatus, spendJudgeVoice } from "./judge";

const ok = { name: "Ada Judge", email: "ada@example.com", competition: "AI in Nigeria", ip: "1.2.3.4" };

beforeEach(() => {
  mem = new MemoryStore();
  process.env.APP_SECRET = "test-secret-test-secret-test-secret-1234";
  delete process.env.JUDGE_AGENT_SESSIONS;
});

describe("judge access requests", () => {
  it("creates a pending request and a poll token the judge keeps", async () => {
    const r = await createJudgeRequest(ok);
    expect(r.id).toBeTruthy();
    expect((await judgeStatus(r.id, r.pollToken)).status).toBe("pending");
  });
  it("rejects missing or bad details and honeypot fills", async () => {
    await expect(createJudgeRequest({ ...ok, name: "" })).rejects.toThrow();
    await expect(createJudgeRequest({ ...ok, email: "not-an-email" })).rejects.toThrow();
    await expect(createJudgeRequest({ ...ok, competition: "" })).rejects.toThrow();
    await expect(createJudgeRequest({ ...ok, website: "http://spam" })).rejects.toThrow();
  });
  it("limits requests per address so the alert channel cannot be flooded", async () => {
    for (let i = 0; i < 3; i++) await createJudgeRequest(ok);
    await expect(createJudgeRequest(ok)).rejects.toThrow(/too many/i);
  });
  it("status needs the right poll token", async () => {
    const r = await createJudgeRequest(ok);
    await expect(judgeStatus(r.id, "wrong")).rejects.toThrow();
  });
});

describe("approval", () => {
  it("approves only with the right signature", async () => {
    const r = await createJudgeRequest(ok);
    await expect(decideJudge(r.id, "bad-sig", "approve")).rejects.toThrow();
    await decideJudge(r.id, decisionSig(r.id), "approve");
    expect((await judgeStatus(r.id, r.pollToken)).status).toBe("approved");
  });
  it("a denied request never gets voice", async () => {
    const r = await createJudgeRequest(ok);
    await decideJudge(r.id, decisionSig(r.id), "deny");
    expect((await judgeStatus(r.id, r.pollToken)).status).toBe("denied");
    expect((await spendJudgeVoice(r.id, "speak")).ok).toBe(false);
  });
  it("the cookie only works for an approved judge and cannot be forged", async () => {
    const r = await createJudgeRequest(ok);
    const cookie = judgeCookie(r.id);
    expect(await judgeFromCookie(cookie)).toBeNull(); // not approved yet
    await decideJudge(r.id, decisionSig(r.id), "approve");
    expect(await judgeFromCookie(cookie)).toBe(r.id);
    expect(await judgeFromCookie(`${r.id}.forged`)).toBeNull();
    expect(await judgeFromCookie(undefined)).toBeNull();
  });
});

describe("caps", () => {
  it("allows only the configured number of live conversations", async () => {
    process.env.JUDGE_AGENT_SESSIONS = "2";
    const r = await createJudgeRequest(ok);
    await decideJudge(r.id, decisionSig(r.id), "approve");
    expect((await spendJudgeVoice(r.id, "agent")).ok).toBe(true);
    expect((await spendJudgeVoice(r.id, "agent")).ok).toBe(true);
    const third = await spendJudgeVoice(r.id, "agent");
    expect(third.ok).toBe(false);
  });
  it("stops after the access window", async () => {
    const r = await createJudgeRequest(ok);
    await decideJudge(r.id, decisionSig(r.id), "approve", Date.now() - 30 * 3600_000);
    expect((await spendJudgeVoice(r.id, "speak")).ok).toBe(false);
  });
  it("a daily ceiling across all judges protects the credits", async () => {
    process.env.JUDGE_GLOBAL_AGENT_PER_DAY = "2";
    process.env.JUDGE_AGENT_SESSIONS = "5";
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await createJudgeRequest({ ...ok, ip: `9.9.9.${i}` });
      await decideJudge(r.id, decisionSig(r.id), "approve");
      ids.push(r.id);
    }
    expect((await spendJudgeVoice(ids[0], "agent")).ok).toBe(true);
    expect((await spendJudgeVoice(ids[1], "agent")).ok).toBe(true);
    expect((await spendJudgeVoice(ids[2], "agent")).ok).toBe(false);
    delete process.env.JUDGE_GLOBAL_AGENT_PER_DAY;
  });
});
