// The only door to Open Payments. Two implementations sit behind it:
//   real.ts  talks to a real wallet through the official SDK
//   mock.ts  is a SIMULATED wallet for building screens before keys exist (MOCK_OP=1)
import type { Amount } from "../money";

export type Role = "merchant" | "wallet";

export interface WalletInfo {
  id: string; // the wallet address URL as the wallet reports it
  publicName?: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer: string;
}

export interface IncomingPaymentInfo {
  id: string; // URL
  walletAddress: string;
  incomingAmount?: Amount;
  receivedAmount: Amount;
  completed: boolean;
  expiresAt?: string;
}

export interface QuoteInfo {
  id: string; // URL
  debitAmount: Amount; // leaves the payer, fees included
  receiveAmount: Amount; // arrives at the receiver
  expiresAt?: string;
}

export interface GrantLimits {
  debitAmount: Amount;
  /** ISO 8601 repeating interval, e.g. R/2026-11-16T00:00:00Z/P1W. Absent for a one-time grant. */
  interval?: string;
}

export interface PendingGrantInfo {
  redirectUrl: string; // the wallet's own consent page
  continueUri: string;
  continueToken: string;
  finishNonce: string; // from the authorization server, used to verify the callback hash
  grantEndpoint: string;
}

export interface GrantToken {
  accessToken: string;
  manageUrl: string;
  expiresIn?: number; // seconds
  continueUri: string;
  continueToken: string;
}

export interface OutgoingPaymentInfo {
  id: string; // URL
  failed: boolean;
  debitAmount: Amount;
  receiveAmount: Amount;
  sentAmount: Amount;
  /** Spent so far in the current interval, as reported by the wallet, when it reports it. */
  grantSpentDebitAmount?: Amount;
}

export type OpErrorKind =
  | "wallet_unreachable" // network failure or timeout
  | "not_found" // unknown wallet address, payment or quote
  | "expired" // incoming payment or quote expired
  | "quote_failed"
  | "grant_rejected" // user declined, or the grant was cancelled / is no longer valid
  | "limit_exceeded" // the wallet refused a payment over the grant limit
  | "invalid_request"
  | "unknown";

export class OpError extends Error {
  constructor(
    public kind: OpErrorKind,
    message: string,
    /** What the wallet actually returned, kept for the build log. Never contains tokens. */
    public detail?: { status?: number; code?: string; description?: string },
  ) {
    super(message);
    this.name = "OpError";
  }
}

export interface PaymentsGateway {
  readonly simulated: boolean;
  getWallet(url: string): Promise<WalletInfo>;
  createIncomingPayment(args: { wallet: WalletInfo; amount: Amount; expiresAt: string; description?: string }): Promise<IncomingPaymentInfo>;
  getIncomingPayment(args: { wallet: WalletInfo; url: string }): Promise<IncomingPaymentInfo>;
  createQuote(args: { wallet: WalletInfo; incomingPaymentUrl: string }): Promise<QuoteInfo>;
  requestOutgoingGrant(args: { wallet: WalletInfo; limits: GrantLimits; finishUri: string; nonce: string }): Promise<PendingGrantInfo>;
  continueGrant(args: { continueUri: string; continueToken: string; interactRef: string }): Promise<GrantToken>;
  rotateToken(args: { manageUrl: string; accessToken: string }): Promise<{ accessToken: string; manageUrl: string; expiresIn?: number }>;
  createOutgoingPayment(args: { wallet: WalletInfo; accessToken: string; quoteId: string; description?: string }): Promise<OutgoingPaymentInfo>;
  getOutgoingPayment(args: { url: string; accessToken: string }): Promise<OutgoingPaymentInfo>;
  cancelGrant(args: { continueUri: string; continueToken: string }): Promise<void>;
}
