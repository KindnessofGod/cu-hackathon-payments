import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "../testing/memoryStore";

let mem = new MemoryStore();
vi.mock("../store", () => ({ getStore: () => mem }));

import { createJudgeRequest, decideJudge, decisionSig, judgeCookie } from "../judge";
import { MOCK_HOST } from "../op/mock";
import { seal } from "../secret";
import { voiceGrant } from "./entitlement";

const demoCustomer = { wallet: { id: `${MOCK_HOST}/demo-1` } };
const realCustomer = { wallet: { id: "https://ilp.interledger-test.dev/ada" } };

beforeEach(() => {
  mem = new MemoryStore();
  process.env.APP_SECRET = "test-secret-test-secret-test-secret-1234";
  delete process.env.VOICE_GATE_ALL;
});

async function approvedJudge() {
  const r = await createJudgeRequest({ name: "Ada Judge", email: "a@b.co", competition: "AI in Nigeria", ip: "1.1.1.1" });
  await decideJudge(r.id, decisionSig(r.id), "approve");
  return judgeCookie(r.id);
}

describe("who may use the owner's voice credits", () => {
  it("leaves real-wallet customers as they were", async () => {
    expect(await voiceGrant(realCustomer, {}, "agent")).toEqual({ who: "owner" });
  });
  it("can lock real-wallet customers too", async () => {
    process.env.VOICE_GATE_ALL = "1";
    expect("denied" in (await voiceGrant(realCustomer, {}, "speak"))).toBe(true);
  });
  it("locks a demo customer with no key and no approval", async () => {
    const g = await voiceGrant(demoCustomer, {}, "speak");
    expect("denied" in g && g.reason).toBe("locked");
  });
  it("an approved judge gets the live agent and counts against the cap", async () => {
    const judge = await approvedJudge();
    const g = await voiceGrant(demoCustomer, { judge }, "agent");
    expect("who" in g && g.who).toBe("judge");
  });
  it("a visitor's own key powers speaking and listening, never the owner's live agent", async () => {
    const byok = seal("sk_test_visitor_key_1234567890");
    const speak = await voiceGrant(demoCustomer, { byok }, "speak");
    expect(speak).toEqual({ who: "byok", elevenKey: "sk_test_visitor_key_1234567890" });
    const agent = await voiceGrant(demoCustomer, { byok }, "agent");
    expect("denied" in agent && agent.reason).toBe("agent_needs_judge");
  });
  it("a garbled key cookie is ignored", async () => {
    const g = await voiceGrant(demoCustomer, { byok: "garbage" }, "speak");
    expect("denied" in g && g.reason).toBe("locked");
  });
});
