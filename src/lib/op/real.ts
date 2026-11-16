// Real Open Payments through the official SDK. Server-side only: keys and tokens never reach a browser.
import { existsSync } from "fs";
import {
  createAuthenticatedClient,
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
  OpenPaymentsClientError,
  type AuthenticatedClient,
} from "@interledger/open-payments";
import type { Amount } from "../money";
import {
  OpError,
  type GrantToken,
  type IncomingPaymentInfo,
  type OutgoingPaymentInfo,
  type PaymentsGateway,
  type PendingGrantInfo,
  type QuoteInfo,
  type Role,
  type WalletInfo,
} from "./types";

const ENV: Record<Role, { url: string; keyId: string; key: string }> = {
  merchant: { url: "RECEIVER_WALLET_ADDRESS_URL", keyId: "RECEIVER_KEY_ID", key: "RECEIVER_PRIVATE_KEY" },
  wallet: { url: "PAYER_WALLET_ADDRESS_URL", keyId: "PAYER_KEY_ID", key: "PAYER_PRIVATE_KEY" },
};

export function realConfigured(role: Role): boolean {
  const e = ENV[role];
  return Boolean(process.env[e.url] && process.env[e.keyId] && process.env[e.key]);
}

function pem(body: string): Buffer {
  const lines = body.match(/.{1,64}/g) ?? [];
  return Buffer.from(`-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`);
}

/**
 * Accepts the downloaded private.key in any of the shapes people paste it in:
 * the whole PEM file, the PEM with its line breaks lost, only the middle base64 line,
 * base64 of the whole file, or a path to the file. The key itself is never logged.
 */
export function loadPrivateKey(raw: string): string | Buffer {
  const v = raw.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  if (v.includes("BEGIN")) {
    const body = v.replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/\s+/g, "");
    return pem(body);
  }
  if (existsSync(v)) return v;
  const compact = v.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=_-]+$/.test(compact)) {
    const decoded = Buffer.from(compact, "base64");
    if (decoded.toString("utf8").includes("BEGIN")) return loadPrivateKey(decoded.toString("utf8"));
    if (decoded[0] === 0x30) return pem(decoded.toString("base64")); // a bare DER key, i.e. only the middle line
  }
  throw new Error("Private key is not in a recognised form (expected the contents of the downloaded private.key).");
}

export function normalizeWalletUrl(input: string): string {
  let v = input.trim();
  if (v.startsWith("$")) v = "https://" + v.slice(1);
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  return v.replace(/\/+$/, "");
}

const clients: Partial<Record<Role, Promise<AuthenticatedClient>>> = {};

function client(role: Role): Promise<AuthenticatedClient> {
  if (!clients[role]) {
    const e = ENV[role];
    const url = process.env[e.url];
    const keyId = process.env[e.keyId];
    const key = process.env[e.key];
    if (!url || !keyId || !key) throw new OpError("invalid_request", `Missing ${e.url}, ${e.keyId} or ${e.key}.`);
    const created = createAuthenticatedClient({
      walletAddressUrl: normalizeWalletUrl(url),
      keyId,
      privateKey: loadPrivateKey(key),
      requestTimeoutMs: 15000,
      logLevel: "silent",
    });
    clients[role] = created;
    created.catch(() => delete clients[role]);
  }
  return clients[role]!;
}

/** Turn an SDK failure into one of our error kinds, keeping what the wallet said. */
function toOpError(e: unknown, context: "wallet" | "incoming" | "quote" | "grant" | "outgoing" | "token"): OpError {
  if (e instanceof OpError) return e;
  if (e instanceof OpenPaymentsClientError) {
    const detail = { status: e.status, code: e.code, description: e.description };
    const text = `${e.description ?? ""} ${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();
    if (e.status === undefined) return new OpError("wallet_unreachable", "The wallet did not answer.", detail);
    if (e.status >= 500) return new OpError("wallet_unreachable", "The wallet reported a server error.", detail);
    if (e.status === 404) return new OpError("not_found", "The wallet could not find it.", detail);
    if (context === "quote") return new OpError("quote_failed", "The wallet could not price this payment.", detail);
    if (context === "outgoing") {
      // Which status and wording the test wallet uses for an over-limit payment is recorded in BUILD_LOG.md once observed.
      if (/limit|insufficient grant|exceed/.test(text)) return new OpError("limit_exceeded", "The wallet refused: over the approved limit.", detail);
      if (e.status === 401 || e.status === 403) return new OpError("grant_rejected", "The wallet refused this payment.", detail);
    }
    if (context === "grant" || context === "token") return new OpError("grant_rejected", "The wallet did not grant permission.", detail);
    if (e.status === 400) return new OpError("invalid_request", "The wallet rejected the request.", detail);
    return new OpError("unknown", "The wallet returned an unexpected error.", detail);
  }
  const msg = e instanceof Error ? e.message : String(e);
  return new OpError("wallet_unreachable", `Could not reach the wallet (${msg}).`);
}

async function withRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const status = e instanceof OpenPaymentsClientError ? e.status : undefined;
      if (status !== undefined && status < 500) break; // the wallet answered; retrying will not help
    }
  }
  throw last;
}

const amount = (a: { value: string; assetCode: string; assetScale: number }): Amount => ({
  value: a.value,
  assetCode: a.assetCode,
  assetScale: a.assetScale,
});

export class RealGateway implements PaymentsGateway {
  readonly simulated = false;
  constructor(private role: Role) {}

  async getWallet(url: string): Promise<WalletInfo> {
    try {
      const c = await client(this.role);
      const w = await withRetry(() => c.walletAddress.get({ url: normalizeWalletUrl(url) }));
      return {
        id: w.id,
        publicName: w.publicName,
        assetCode: w.assetCode,
        assetScale: w.assetScale,
        authServer: w.authServer,
        resourceServer: w.resourceServer,
      };
    } catch (e) {
      throw toOpError(e, "wallet");
    }
  }

  private async nonInteractiveToken(wallet: WalletInfo, type: "incoming-payment" | "quote"): Promise<string> {
    const c = await client(this.role);
    const access =
      type === "incoming-payment"
        ? [{ type: "incoming-payment" as const, actions: ["create" as const, "read" as const, "complete" as const] }]
        : [{ type: "quote" as const, actions: ["create" as const, "read" as const] }];
    const grant = await c.grant.request({ url: wallet.authServer }, { access_token: { access } });
    if (isPendingGrant(grant)) throw new OpError("grant_rejected", `The wallet asked for interaction on a ${type} grant.`);
    if (!grant.access_token) throw new OpError("grant_rejected", `No access token for the ${type} grant.`);
    return grant.access_token.value;
  }

  async createIncomingPayment(args: { wallet: WalletInfo; amount: Amount; expiresAt: string; description?: string }): Promise<IncomingPaymentInfo> {
    try {
      const c = await client(this.role);
      const token = await this.nonInteractiveToken(args.wallet, "incoming-payment");
      const p = await c.incomingPayment.create(
        { url: args.wallet.resourceServer, accessToken: token },
        {
          walletAddress: args.wallet.id,
          incomingAmount: args.amount,
          expiresAt: args.expiresAt,
          metadata: args.description ? { description: args.description } : undefined,
        },
      );
      return this.incoming(p);
    } catch (e) {
      throw toOpError(e, "incoming");
    }
  }

  async getIncomingPayment(args: { wallet: WalletInfo; url: string }): Promise<IncomingPaymentInfo> {
    try {
      const c = await client(this.role);
      const token = await this.nonInteractiveToken(args.wallet, "incoming-payment");
      const p = await withRetry(() => c.incomingPayment.get({ url: args.url, accessToken: token }));
      return this.incoming(p);
    } catch (e) {
      throw toOpError(e, "incoming");
    }
  }

  private incoming(p: {
    id: string;
    walletAddress: string;
    incomingAmount?: Amount;
    receivedAmount: Amount;
    completed: boolean;
    expiresAt?: string;
  }): IncomingPaymentInfo {
    return {
      id: p.id,
      walletAddress: p.walletAddress,
      incomingAmount: p.incomingAmount ? amount(p.incomingAmount) : undefined,
      receivedAmount: amount(p.receivedAmount),
      completed: p.completed,
      expiresAt: p.expiresAt,
    };
  }

  async createQuote(args: { wallet: WalletInfo; incomingPaymentUrl: string }): Promise<QuoteInfo> {
    try {
      const c = await client(this.role);
      const token = await this.nonInteractiveToken(args.wallet, "quote");
      const q = await c.quote.create(
        { url: args.wallet.resourceServer, accessToken: token },
        { method: "ilp", walletAddress: args.wallet.id, receiver: args.incomingPaymentUrl },
      );
      return { id: q.id, debitAmount: amount(q.debitAmount), receiveAmount: amount(q.receiveAmount), expiresAt: q.expiresAt };
    } catch (e) {
      throw toOpError(e, "quote");
    }
  }

  async requestOutgoingGrant(args: {
    wallet: WalletInfo;
    limits: { debitAmount: Amount; interval?: string };
    finishUri: string;
    nonce: string;
  }): Promise<PendingGrantInfo> {
    try {
      const c = await client(this.role);
      const grant = await c.grant.request(
        { url: args.wallet.authServer },
        {
          access_token: {
            access: [
              {
                type: "outgoing-payment",
                actions: ["create", "read"],
                identifier: args.wallet.id,
                limits: args.limits.interval
                  ? { debitAmount: args.limits.debitAmount, interval: args.limits.interval }
                  : { debitAmount: args.limits.debitAmount },
              },
            ],
          },
          interact: { start: ["redirect"], finish: { method: "redirect", uri: args.finishUri, nonce: args.nonce } },
        },
      );
      if (!isPendingGrant(grant)) throw new OpError("grant_rejected", "Expected the wallet to ask the user for consent.");
      return {
        redirectUrl: grant.interact.redirect,
        continueUri: grant.continue.uri,
        continueToken: grant.continue.access_token.value,
        finishNonce: grant.interact.finish,
        grantEndpoint: args.wallet.authServer,
      };
    } catch (e) {
      throw toOpError(e, "grant");
    }
  }

  async continueGrant(args: { continueUri: string; continueToken: string; interactRef: string }): Promise<GrantToken> {
    try {
      const c = await client(this.role);
      const grant = await c.grant.continue({ url: args.continueUri, accessToken: args.continueToken }, { interact_ref: args.interactRef });
      if (!isFinalizedGrantWithAccessToken(grant)) throw new OpError("grant_rejected", "The wallet did not issue an access token.");
      return {
        accessToken: grant.access_token.value,
        manageUrl: grant.access_token.manage,
        expiresIn: grant.access_token.expires_in,
        continueUri: grant.continue.uri,
        continueToken: grant.continue.access_token.value,
      };
    } catch (e) {
      throw toOpError(e, "grant");
    }
  }

  async rotateToken(args: { manageUrl: string; accessToken: string }) {
    try {
      const c = await client(this.role);
      const t = await c.token.rotate({ url: args.manageUrl, accessToken: args.accessToken });
      return { accessToken: t.access_token.value, manageUrl: t.access_token.manage, expiresIn: t.access_token.expires_in };
    } catch (e) {
      throw toOpError(e, "token");
    }
  }

  async createOutgoingPayment(args: { wallet: WalletInfo; accessToken: string; quoteId: string; description?: string }): Promise<OutgoingPaymentInfo> {
    try {
      const c = await client(this.role);
      const p = await c.outgoingPayment.create(
        { url: args.wallet.resourceServer, accessToken: args.accessToken },
        { walletAddress: args.wallet.id, quoteId: args.quoteId, metadata: args.description ? { description: args.description } : undefined },
      );
      const spent = (p as { grantSpentDebitAmount?: Amount }).grantSpentDebitAmount;
      return {
        id: p.id,
        failed: p.failed,
        debitAmount: amount(p.debitAmount),
        receiveAmount: amount(p.receiveAmount),
        sentAmount: amount(p.sentAmount),
        grantSpentDebitAmount: spent ? amount(spent) : undefined,
      };
    } catch (e) {
      throw toOpError(e, "outgoing");
    }
  }

  async getOutgoingPayment(args: { url: string; accessToken: string }): Promise<OutgoingPaymentInfo> {
    try {
      const c = await client(this.role);
      const p = await withRetry(() => c.outgoingPayment.get({ url: args.url, accessToken: args.accessToken }));
      return { id: p.id, failed: p.failed, debitAmount: amount(p.debitAmount), receiveAmount: amount(p.receiveAmount), sentAmount: amount(p.sentAmount) };
    } catch (e) {
      throw toOpError(e, "outgoing");
    }
  }

  async cancelGrant(args: { continueUri: string; continueToken: string }): Promise<void> {
    try {
      const c = await client(this.role);
      await c.grant.cancel({ url: args.continueUri, accessToken: args.continueToken });
    } catch (e) {
      throw toOpError(e, "grant");
    }
  }
}
