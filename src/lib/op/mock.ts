// SIMULATED wallet. Used only when MOCK_OP=1, so screens and failure states can be built before
// real keys exist. Nothing here talks to Open Payments, and every screen shows a SIMULATED banner
// while it is active. Its fee, its limit checks and its consent page are stand-ins, not evidence.
import { randomBytes, randomUUID } from "crypto";
import type { Amount } from "../money";
import { periodKey } from "../interval";
import { getStore } from "../store";
import { interactionHash } from "./hash";
import {
  OpError,
  type GrantLimits,
  type GrantToken,
  type IncomingPaymentInfo,
  type OutgoingPaymentInfo,
  type PaymentsGateway,
  type PendingGrantInfo,
  type QuoteInfo,
  type WalletInfo,
} from "./types";

export const MOCK_HOST = "https://mock-wallet.invalid";
const AUTH = `${MOCK_HOST}/auth`;
const ASSET = { assetCode: "NGN", assetScale: 2 };
const TOKEN_LIFETIME_S = 600;

export interface MockGrant {
  id: string;
  walletId: string;
  limits: GrantLimits;
  finishUri: string;
  clientNonce: string;
  finishNonce: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  interactRef?: string;
  continueToken: string;
  accessToken?: string;
  tokenExpiresAt?: number;
  spent: { period: string; value: string };
}

interface MockQuote extends QuoteInfo {
  walletId: string;
  receiver: string;
}

const token = () => randomBytes(18).toString("base64url");

export class MockGateway implements PaymentsGateway {
  readonly simulated = true;
  private get store() {
    return getStore();
  }

  async getWallet(url: string): Promise<WalletInfo> {
    const clean = url.trim().replace(/\/+$/, "");
    const name = clean.split("/").pop() ?? "";
    if (!clean.startsWith(MOCK_HOST + "/") || !/^[a-z0-9-]{2,40}$/i.test(name)) {
      throw new OpError("not_found", "No simulated wallet at that address.", { status: 404, description: "simulated" });
    }
    if (name === "offline") throw new OpError("wallet_unreachable", "The wallet did not answer.", { description: "simulated outage" });
    return { id: clean, publicName: name.replace(/-/g, " "), ...ASSET, authServer: AUTH, resourceServer: `${MOCK_HOST}/rs` };
  }

  async createIncomingPayment(args: { wallet: WalletInfo; amount: Amount; expiresAt: string }): Promise<IncomingPaymentInfo> {
    const p: IncomingPaymentInfo = {
      id: `${MOCK_HOST}/incoming-payments/${randomUUID()}`,
      walletAddress: args.wallet.id,
      incomingAmount: args.amount,
      receivedAmount: { ...args.amount, value: "0" },
      completed: false,
      expiresAt: args.expiresAt,
    };
    await this.store.put("mock_incoming", p.id, p);
    return p;
  }

  async getIncomingPayment(args: { url: string }): Promise<IncomingPaymentInfo> {
    const p = await this.store.get<IncomingPaymentInfo>("mock_incoming", args.url);
    if (!p) throw new OpError("not_found", "The wallet could not find it.", { status: 404, description: "simulated" });
    return p;
  }

  async createQuote(args: { wallet: WalletInfo; incomingPaymentUrl: string }): Promise<QuoteInfo> {
    const p = await this.getIncomingPayment({ url: args.incomingPaymentUrl });
    if (p.completed) throw new OpError("quote_failed", "The wallet could not price this payment.", { status: 400, description: "simulated: already paid" });
    if (p.expiresAt && Date.parse(p.expiresAt) < Date.now()) {
      throw new OpError("expired", "The payment request has expired.", { status: 400, description: "simulated: incoming payment expired" });
    }
    const receive = p.incomingAmount!;
    // Simulated fee of 1%, rounded up to a whole minor unit. The real wallet sets its own fee.
    const fee = (BigInt(receive.value) + BigInt(99)) / BigInt(100);
    const q: MockQuote = {
      id: `${MOCK_HOST}/quotes/${randomUUID()}`,
      walletId: args.wallet.id,
      receiver: p.id,
      receiveAmount: receive,
      debitAmount: { ...receive, value: (BigInt(receive.value) + fee).toString() },
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
    await this.store.put("mock_quotes", q.id, q);
    return { id: q.id, debitAmount: q.debitAmount, receiveAmount: q.receiveAmount, expiresAt: q.expiresAt };
  }

  async requestOutgoingGrant(args: { wallet: WalletInfo; limits: GrantLimits; finishUri: string; nonce: string }): Promise<PendingGrantInfo> {
    const g: MockGrant = {
      id: randomUUID(),
      walletId: args.wallet.id,
      limits: args.limits,
      finishUri: args.finishUri,
      clientNonce: args.nonce,
      finishNonce: token(),
      status: "pending",
      continueToken: token(),
      spent: { period: periodKey(args.limits.interval, Date.now()), value: "0" },
    };
    await this.store.put("mock_grants", g.id, g);
    return {
      redirectUrl: `/mock-wallet/consent?grant=${g.id}`,
      continueUri: `${AUTH}/continue/${g.id}`,
      continueToken: g.continueToken,
      finishNonce: g.finishNonce,
      grantEndpoint: AUTH,
    };
  }

  private async grantByContinue(continueUri: string, continueToken: string): Promise<MockGrant> {
    const g = await this.store.get<MockGrant>("mock_grants", continueUri.split("/").pop() ?? "");
    if (!g || g.continueToken !== continueToken) throw new OpError("grant_rejected", "The wallet did not grant permission.", { status: 401, description: "simulated" });
    return g;
  }

  async continueGrant(args: { continueUri: string; continueToken: string; interactRef: string }): Promise<GrantToken> {
    const g = await this.grantByContinue(args.continueUri, args.continueToken);
    if (g.status !== "approved" || g.interactRef !== args.interactRef) {
      throw new OpError("grant_rejected", "The wallet did not grant permission.", { status: 401, description: "simulated" });
    }
    g.accessToken = token();
    g.tokenExpiresAt = Date.now() + TOKEN_LIFETIME_S * 1000;
    await this.store.put("mock_grants", g.id, g);
    return {
      accessToken: g.accessToken,
      manageUrl: `${AUTH}/token/${g.id}`,
      expiresIn: TOKEN_LIFETIME_S,
      continueUri: args.continueUri,
      continueToken: g.continueToken,
    };
  }

  async rotateToken(args: { manageUrl: string; accessToken: string }) {
    const g = await this.store.get<MockGrant>("mock_grants", args.manageUrl.split("/").pop() ?? "");
    if (!g || g.status !== "approved" || g.accessToken !== args.accessToken) {
      throw new OpError("grant_rejected", "The wallet did not grant permission.", { status: 401, description: "simulated" });
    }
    g.accessToken = token();
    g.tokenExpiresAt = Date.now() + TOKEN_LIFETIME_S * 1000;
    await this.store.put("mock_grants", g.id, g);
    return { accessToken: g.accessToken, manageUrl: args.manageUrl, expiresIn: TOKEN_LIFETIME_S };
  }

  async createOutgoingPayment(args: { wallet: WalletInfo; accessToken: string; quoteId: string }): Promise<OutgoingPaymentInfo> {
    const grants = await this.store.list<MockGrant>("mock_grants");
    const g = grants.find((x) => x.accessToken === args.accessToken && x.walletId === args.wallet.id);
    if (!g || g.status !== "approved" || (g.tokenExpiresAt ?? 0) < Date.now()) {
      throw new OpError("grant_rejected", "The wallet refused this payment.", { status: 401, description: "simulated: token not valid" });
    }
    const q = await this.store.get<MockQuote>("mock_quotes", args.quoteId);
    if (!q) throw new OpError("not_found", "The wallet could not find it.", { status: 404, description: "simulated" });
    if (q.expiresAt && Date.parse(q.expiresAt) < Date.now()) throw new OpError("expired", "The quote has expired.", { status: 400, description: "simulated" });

    const period = periodKey(g.limits.interval, Date.now());
    const spentBefore = g.spent.period === period ? BigInt(g.spent.value) : BigInt(0);
    const spentAfter = spentBefore + BigInt(q.debitAmount.value);
    if (spentAfter > BigInt(g.limits.debitAmount.value)) {
      throw new OpError("limit_exceeded", "The wallet refused: over the approved limit.", { status: 403, description: "simulated: over grant limit" });
    }
    const incoming = await this.getIncomingPayment({ url: q.receiver });
    incoming.receivedAmount = q.receiveAmount;
    incoming.completed = true;
    await this.store.put("mock_incoming", incoming.id, incoming);
    g.spent = { period, value: spentAfter.toString() };
    await this.store.put("mock_grants", g.id, g);

    const p: OutgoingPaymentInfo = {
      id: `${MOCK_HOST}/outgoing-payments/${randomUUID()}`,
      failed: false,
      debitAmount: q.debitAmount,
      receiveAmount: q.receiveAmount,
      sentAmount: q.receiveAmount,
      grantSpentDebitAmount: { ...q.debitAmount, value: spentAfter.toString() },
    };
    await this.store.put("mock_outgoing", p.id, p);
    return p;
  }

  async getOutgoingPayment(args: { url: string }): Promise<OutgoingPaymentInfo> {
    const p = await this.store.get<OutgoingPaymentInfo>("mock_outgoing", args.url);
    if (!p) throw new OpError("not_found", "The wallet could not find it.", { status: 404, description: "simulated" });
    return p;
  }

  async cancelGrant(args: { continueUri: string; continueToken: string }): Promise<void> {
    const g = await this.grantByContinue(args.continueUri, args.continueToken);
    g.status = "cancelled";
    g.accessToken = undefined;
    await this.store.put("mock_grants", g.id, g);
  }
}

/** Used by the simulated consent page only. Returns where to send the browser next. */
export async function decideMockConsent(grantId: string, approve: boolean): Promise<string> {
  const store = getStore();
  const g = await store.get<MockGrant>("mock_grants", grantId);
  if (!g || g.status !== "pending") throw new OpError("not_found", "This simulated consent request is no longer open.");
  const url = new URL(g.finishUri);
  if (!approve) {
    g.status = "rejected";
    url.searchParams.set("result", "grant_rejected");
  } else {
    g.status = "approved";
    g.interactRef = token();
    url.searchParams.set("interact_ref", g.interactRef);
    url.searchParams.set("hash", interactionHash(g.clientNonce, g.finishNonce, g.interactRef, AUTH));
  }
  await store.put("mock_grants", g.id, g);
  return url.toString();
}

export async function getMockGrant(grantId: string): Promise<MockGrant | null> {
  return getStore().get<MockGrant>("mock_grants", grantId);
}
