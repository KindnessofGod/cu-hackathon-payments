// "Request judge access": a judge asks, the owner is alerted and approves in one tap, and the judge's browser
// then gets the owner's live voice for a short time and a small, hard cap. Nothing here moves money.
import { timingSafeEqual } from "crypto";
import { DomainError } from "./domain";
import { randomToken, sha256, sign } from "./secret";
import { getStore } from "./store";

export type JudgeUse = "agent" | "speak" | "listen";
export type JudgeStatus = "pending" | "approved" | "denied";

export interface JudgeRequest {
  id: string;
  name: string;
  email: string;
  competition: string;
  createdAt: string;
  status: JudgeStatus;
  pollHash: string;
  ipHash: string;
  approvedAt?: string;
  expiresAt?: string;
  usage: Record<JudgeUse, number>;
}

const COLLECTION = "judge_requests";
const COUNTERS = "judge_counters";

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/** The hard caps. All can be changed with environment variables; the defaults are deliberately small. */
export function judgeLimits() {
  return {
    hours: num("JUDGE_HOURS", 24),
    agent: num("JUDGE_AGENT_SESSIONS", 3), // live conversations per judge (each is at most 10 minutes: the agent's own limit)
    speak: num("JUDGE_SPEAKS", 150), // spoken sentences (the browser may fetch one sentence more than once)
    listen: num("JUDGE_LISTENS", 80),
    globalAgentPerDay: num("JUDGE_GLOBAL_AGENT_PER_DAY", 30), // live conversations across ALL judges per day
    perIpPerHour: 3,
    pendingMax: 40,
  };
}

const bad = (m: string) => new DomainError("bad_input", m);

export async function createJudgeRequest(input: {
  name: string;
  email: string;
  competition: string;
  ip: string;
  website?: string; // a hidden field only bots fill in
}): Promise<{ id: string; pollToken: string; request: JudgeRequest }> {
  if (input.website) throw bad("Could not send the request.");
  const name = input.name.trim();
  const email = input.email.trim();
  const competition = input.competition.trim();
  if (name.length < 2 || name.length > 80) throw bad("Enter your name.");
  if (!/^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/.test(email) || email.length > 120) throw bad("Enter a valid email address.");
  if (competition.length < 2 || competition.length > 120) throw bad("Enter the competition you are judging for.");

  const L = judgeLimits();
  const all = await getStore().list<JudgeRequest>(COLLECTION);
  const ipHash = sha256(`ip:${input.ip}`);
  const hourAgo = Date.now() - 3600_000;
  if (all.filter((r) => r.ipHash === ipHash && Date.parse(r.createdAt) > hourAgo).length >= L.perIpPerHour) {
    throw new DomainError("not_allowed", "Too many requests from this connection. Try again in an hour.");
  }
  if (all.filter((r) => r.status === "pending").length >= L.pendingMax) {
    throw new DomainError("not_allowed", "Too many requests are waiting right now. Please try again later.");
  }

  const pollToken = randomToken(18);
  const request: JudgeRequest = {
    id: randomToken(10),
    name,
    email,
    competition,
    createdAt: new Date().toISOString(),
    status: "pending",
    pollHash: sha256(pollToken),
    ipHash,
    usage: { agent: 0, speak: 0, listen: 0 },
  };
  await getStore().put(COLLECTION, request.id, request);
  return { id: request.id, pollToken, request };
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The signature in the approve link sent to the owner. Whoever holds the link can decide. */
export function decisionSig(id: string): string {
  return sign(`judge-decide:${id}`);
}

export async function decideJudge(id: string, sig: string, decision: "approve" | "deny", now = Date.now()): Promise<JudgeRequest> {
  if (!same(String(sig), decisionSig(id))) throw new DomainError("not_allowed", "This approval link is not valid.");
  const r = await getStore().get<JudgeRequest>(COLLECTION, id);
  if (!r) throw new DomainError("not_found", "That request does not exist.");
  if (decision === "approve") {
    r.status = "approved";
    r.approvedAt = new Date(now).toISOString();
    r.expiresAt = new Date(now + judgeLimits().hours * 3600_000).toISOString();
  } else {
    r.status = "denied";
    r.expiresAt = undefined;
  }
  await getStore().put(COLLECTION, r.id, r);
  return r;
}

/** What the judge's browser may see about its own request. Needs the poll token it was given. */
export async function judgeStatus(id: string, pollToken: string) {
  const r = await getStore().get<JudgeRequest>(COLLECTION, id);
  if (!r || !same(sha256(String(pollToken)), r.pollHash)) throw new DomainError("not_found", "That request does not exist.");
  return { status: r.status, expiresAt: r.expiresAt, usage: r.usage, limits: judgeLimits(), name: r.name };
}

export function judgeCookie(id: string): string {
  return `${id}.${sign(`judge-cookie:${id}`).slice(0, 32)}`;
}

function live(r: JudgeRequest | null, now = Date.now()): r is JudgeRequest {
  return Boolean(r && r.status === "approved" && r.expiresAt && Date.parse(r.expiresAt) > now);
}

/** The judge's id if the cookie is genuine and the access is approved and still inside its window. */
export async function judgeFromCookie(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [id, tag] = value.split(".");
  if (!id || !tag || !same(tag, sign(`judge-cookie:${id}`).slice(0, 32))) return null;
  const r = await getStore().get<JudgeRequest>(COLLECTION, id);
  return live(r) ? id : null;
}

/** Counts one use of the owner's voice against this judge's caps and the daily ceiling. */
export async function spendJudgeVoice(id: string, use: JudgeUse): Promise<{ ok: true } | { ok: false; reason: string }> {
  const r = await getStore().get<JudgeRequest>(COLLECTION, id);
  if (!live(r)) return { ok: false, reason: "Your judge access has ended." };
  const L = judgeLimits();
  if (r.usage[use] >= L[use]) {
    return { ok: false, reason: use === "agent" ? "You have used all your live conversations. Voice answers and typing still work." : "You have used all your voice allowance." };
  }
  if (use === "agent") {
    const day = new Date().toISOString().slice(0, 10);
    const counter = (await getStore().get<{ n: number }>(COUNTERS, `agent-${day}`)) ?? { n: 0 };
    if (counter.n >= L.globalAgentPerDay) return { ok: false, reason: "Live voice has reached today's limit. Please try again tomorrow." };
    await getStore().put(COUNTERS, `agent-${day}`, { n: counter.n + 1 });
  }
  r.usage[use] += 1;
  await getStore().put(COLLECTION, r.id, r);
  return { ok: true };
}

export async function listJudgeRequests(): Promise<JudgeRequest[]> {
  return (await getStore().list<JudgeRequest>(COLLECTION)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
}
