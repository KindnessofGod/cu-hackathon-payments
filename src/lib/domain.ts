// What the two apps do, in one place. Route handlers call these; nothing here renders UI.
import { randomInt } from "crypto";
import { challengeIsValid, issueChallenge, verifyApproval, type ApprovalChallenge, type ApprovalProof } from "./approval";
import { makeInterval, periodEnd, periodKey, type Every } from "./interval";
import { exceedsCap, formatAmount, parseMajor, remainingOfCap, type Amount } from "./money";
import { gateway, isSimulated, OpError, type OpErrorKind, type QuoteInfo, type WalletInfo } from "./op";
import { verifyInteractionHash } from "./op/hash";
import { MOCK_HOST } from "./op/mock";
import { normalizeWalletUrl } from "./op/real";
import {
  approvalChallengeForDevice,
  finishRegistration,
  registrationOptions,
  verifyPasskeySignature,
  type PendingRegistration,
  type StoredPasskey,
} from "./passkey";
import { spkiFromX963, verifyDeviceSignature, type StoredDeviceKey } from "./devicekey";
import { open, randomToken, seal, sha256 } from "./secret";
import { getStore } from "./store";

// ---------- records ----------

export interface Contact {
  walletId: string;
  name: string;
  paidCount: number;
  lastPaidAt: string;
}

interface CapSecrets {
  accessToken: string;
  manageUrl: string;
  continueUri: string;
  continueToken: string;
}

export interface Cap {
  limit: Amount;
  interval: string;
  every: Every;
  status: "active" | "stopped";
  grantedAt: string;
  stoppedAt?: string;
  sealed: string; // CapSecrets, encrypted. Never sent to a browser, never logged.
  tokenExpiresAt: number;
  /** Our own running total for the current period. */
  spent: { period: string; value: string };
  /** The wallet's own figure, when it reports one after a payment. */
  walletReportedSpent?: Amount;
}

export interface Customer {
  id: string;
  payCode: string;
  deviceHash: string;
  wallet: WalletInfo;
  createdAt: string;
  cap?: Cap;
  contacts: Record<string, Contact>;
  /** Fingerprint passkeys. Once one exists, every payment needs a fingerprint. */
  passkeys?: StoredPasskey[];
  passkeyRegistration?: PendingRegistration;
  /** Secure Enclave keys from the native iPad app (ios/). Count as a fingerprint too. */
  deviceKeys?: StoredDeviceKey[];
  deviceKeyChallenge?: { challenge: string; expiresAt: string };
}

function hasFingerprint(c: Customer): boolean {
  return Boolean(c.passkeys?.length || c.deviceKeys?.length);
}

export type RequestStatus = "waiting" | "quoted" | "consent" | "paying" | "paid" | "declined" | "expired" | "failed";

export interface Failure {
  kind: OpErrorKind | "approval_invalid";
  message: string;
  /** What the wallet returned, shown as-is so nobody has to trust our wording. */
  walletSaid?: string;
}

export interface PaymentRequest {
  id: string;
  merchantWalletId: string;
  merchantName: string;
  customerId: string;
  customerPayCode: string;
  requested: Amount;
  incomingPaymentUrl: string;
  status: RequestStatus;
  quote?: QuoteInfo;
  approval?: ApprovalChallenge;
  consentBy?: "cap" | "once";
  outgoingPaymentUrl?: string;
  paid?: { debitAmount: Amount; receiveAmount: Amount; at: string };
  failure?: Failure;
  createdAt: string;
  expiresAt: string;
}

interface GrantSession {
  id: string;
  customerId: string;
  purpose: "cap" | "once";
  requestId?: string;
  limit: Amount;
  interval?: string;
  every?: Every;
  clientNonce: string;
  finishNonce: string;
  grantEndpoint: string;
  sealed: string; // { continueUri, continueToken }
  createdAt: string;
}

export class DomainError extends Error {
  constructor(
    public code: "not_found" | "bad_input" | "not_allowed" | "wrong_state",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

const store = () => getStore();
const REQUEST_TTL_MS = Number(process.env.REQUEST_TTL_SECONDS ?? 180) * 1000;

function failureFrom(e: unknown): Failure {
  if (e instanceof OpError) {
    const d = e.detail;
    const walletSaid = d ? [...new Set([d.status, d.code, d.description].filter(Boolean).map(String))].join(" ") : undefined;
    return { kind: e.kind, message: e.message, walletSaid: walletSaid || undefined };
  }
  return { kind: "unknown", message: e instanceof Error ? e.message : "Something went wrong." };
}

async function sixDigits(taken: (code: string) => Promise<boolean>): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = String(randomInt(100000, 1000000));
    if (!(await taken(code))) return code;
  }
  throw new Error("Could not allocate a code.");
}

// ---------- merchant app ----------

export function merchantWalletUrl(): string {
  if (isSimulated()) return `${MOCK_HOST}/mama-chidi-shop`;
  const url = process.env.RECEIVER_WALLET_ADDRESS_URL;
  if (!url) throw new OpError("invalid_request", "RECEIVER_WALLET_ADDRESS_URL is not set.");
  return url;
}

export async function merchantInfo() {
  const w = await gateway("merchant").getWallet(merchantWalletUrl());
  return { name: w.publicName ?? w.id, walletAddress: w.id, assetCode: w.assetCode, assetScale: w.assetScale };
}

export async function recentCustomers() {
  const customers = await store().list<Customer>("customers");
  const requests = (await store().list<PaymentRequest>("requests")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Map<string, { payCode: string; name: string; lastRequestAt: string }>();
  for (const r of requests) {
    if (seen.has(r.customerPayCode)) continue;
    const c = customers.find((x) => x.id === r.customerId);
    if (c) seen.set(r.customerPayCode, { payCode: c.payCode, name: c.wallet.publicName ?? "Customer", lastRequestAt: r.createdAt });
    if (seen.size >= 5) break;
  }
  return [...seen.values()];
}

export async function createRequest(payCode: string, amountMajor: string): Promise<PaymentRequest> {
  const code = payCode.replace(/\D/g, "");
  const customer = (await store().list<Customer>("customers")).find((c) => c.payCode === code);
  if (!customer) throw new DomainError("not_found", "No customer has that pay code. Check the six digits.");

  const g = gateway("merchant");
  const wallet = await g.getWallet(merchantWalletUrl());
  const minor = parseMajor(amountMajor, wallet.assetScale);
  if (!minor) throw new DomainError("bad_input", "Enter an amount greater than zero, for example 2000.");

  const now = Date.now();
  const expiresAt = new Date(now + REQUEST_TTL_MS).toISOString();
  const requested: Amount = { value: minor, assetCode: wallet.assetCode, assetScale: wallet.assetScale };
  const incoming = await g.createIncomingPayment({ wallet, amount: requested, expiresAt, description: "Payment request" });

  const request: PaymentRequest = {
    id: randomToken(12),
    merchantWalletId: wallet.id,
    merchantName: wallet.publicName ?? wallet.id,
    customerId: customer.id,
    customerPayCode: customer.payCode,
    requested: incoming.incomingAmount ?? requested,
    incomingPaymentUrl: incoming.id,
    status: "waiting",
    createdAt: new Date(now).toISOString(),
    expiresAt,
  };
  await store().put("requests", request.id, request);
  return request;
}

export type MerchantStatus = "waiting" | "received" | "declined" | "expired" | "failed";

/**
 * What the seller is told when a payment does not happen. Deliberately vague: the seller must not
 * learn the customer's limit or why their wallet refused.
 */
function sellerReason(status: MerchantStatus | RequestStatus): string | undefined {
  if (status === "declined") return "The customer said no, or did not confirm. No money moved.";
  if (status === "failed") return "The customer's wallet did not make this payment. No money moved.";
  if (status === "expired") return "No money moved.";
  return undefined;
}

/** What the seller sees. The received amount is read from the seller's wallet, not from what was typed. */
export async function merchantView(requestId: string) {
  const request = await store().get<PaymentRequest>("requests", requestId);
  if (!request) throw new DomainError("not_found", "That request does not exist.");
  const g = gateway("merchant");
  const wallet = await g.getWallet(request.merchantWalletId);
  const incoming = await g.getIncomingPayment({ wallet, url: request.incomingPaymentUrl });

  const received = BigInt(incoming.receivedAmount.value);
  const wanted = BigInt((incoming.incomingAmount ?? request.requested).value);
  let status: MerchantStatus = "waiting";
  if (incoming.completed || (received > BigInt(0) && received >= wanted)) status = "received";
  else if (request.status === "declined") status = "declined";
  else if (request.status === "failed") status = "failed";
  else if (Date.parse(request.expiresAt) < Date.now()) status = "expired";

  return {
    id: request.id,
    status,
    requested: request.requested,
    received: incoming.receivedAmount,
    customerPayCode: request.customerPayCode,
    expiresAt: request.expiresAt,
    reason: sellerReason(status),
  };
}

// ---------- wallet app: identity ----------

export async function setupCustomer(walletUrl: string): Promise<{ customer: Customer; deviceToken: string }> {
  const wallet = await gateway("wallet").getWallet(walletUrl);
  const customers = await store().list<Customer>("customers");
  const secret = randomToken(24);
  const customer: Customer = {
    id: randomToken(12),
    payCode: await sixDigits(async (code) => customers.some((c) => c.payCode === code)),
    deviceHash: sha256(secret),
    wallet,
    createdAt: new Date().toISOString(),
    contacts: {},
  };
  await store().put("customers", customer.id, customer);
  return { customer, deviceToken: `${customer.id}.${secret}` };
}

export async function customerFromDeviceToken(token: string | undefined): Promise<Customer | null> {
  if (!token) return null;
  const [id, secret] = token.split(".");
  if (!id || !secret) return null;
  const customer = await store().get<Customer>("customers", id);
  return customer && customer.deviceHash === sha256(secret) ? customer : null;
}

// ---------- wallet app: cap ----------

function capSpent(cap: Cap, now = Date.now()): Amount {
  const period = periodKey(cap.interval, now);
  return { ...cap.limit, value: cap.spent.period === period ? cap.spent.value : "0" };
}

export function capSummary(cap: Cap | undefined) {
  if (!cap) return null;
  const spent = capSpent(cap);
  return {
    status: cap.status,
    limit: cap.limit,
    every: cap.every,
    spent,
    left: remainingOfCap(cap.limit, spent),
    periodEnds: periodEnd(cap.interval, Date.now()),
    grantedAt: cap.grantedAt,
    walletReportedSpent: cap.walletReportedSpent,
  };
}

export async function startCap(customer: Customer, amountMajor: string, every: Every, baseUrl: string): Promise<string> {
  const minor = parseMajor(amountMajor, customer.wallet.assetScale);
  if (!minor) throw new DomainError("bad_input", "Enter a limit greater than zero, for example 20000.");
  if (every !== "day" && every !== "week") throw new DomainError("bad_input", "Choose a day or a week.");
  const limit: Amount = { value: minor, assetCode: customer.wallet.assetCode, assetScale: customer.wallet.assetScale };
  return startGrant(customer, { purpose: "cap", limit, interval: makeInterval(every, new Date()), every }, baseUrl);
}

async function startGrant(
  customer: Customer,
  s: { purpose: "cap" | "once"; limit: Amount; interval?: string; every?: Every; requestId?: string },
  baseUrl: string,
): Promise<string> {
  const id = randomToken(16);
  const clientNonce = randomToken(16);
  const pending = await gateway("wallet").requestOutgoingGrant({
    wallet: customer.wallet,
    limits: { debitAmount: s.limit, interval: s.interval },
    finishUri: `${baseUrl}/api/wallet/callback?session=${id}`,
    nonce: clientNonce,
  });
  const session: GrantSession = {
    id,
    customerId: customer.id,
    purpose: s.purpose,
    requestId: s.requestId,
    limit: s.limit,
    interval: s.interval,
    every: s.every,
    clientNonce,
    finishNonce: pending.finishNonce,
    grantEndpoint: pending.grantEndpoint,
    sealed: seal(JSON.stringify({ continueUri: pending.continueUri, continueToken: pending.continueToken })),
    createdAt: new Date().toISOString(),
  };
  await store().put("grant_sessions", id, session);
  return pending.redirectUrl;
}

export type CallbackOutcome = "cap_set" | "paid" | "declined" | "failed";

/** The wallet's consent page sends the browser back here. */
export async function handleCallback(
  customer: Customer | null,
  sessionId: string,
  params: { interactRef?: string; hash?: string; result?: string },
): Promise<{ outcome: CallbackOutcome; message?: string }> {
  const session = await store().get<GrantSession>("grant_sessions", sessionId);
  if (!session) return { outcome: "failed", message: "This consent link was already used or has expired." };
  if (!customer || customer.id !== session.customerId) return { outcome: "failed", message: "This consent belongs to a different device." };
  await store().delete("grant_sessions", sessionId); // single use

  const request = session.requestId ? await store().get<PaymentRequest>("requests", session.requestId) : null;
  const fail = async (failure: Failure, status: RequestStatus, outcome: CallbackOutcome) => {
    if (request) {
      request.status = status;
      request.failure = failure;
      await store().put("requests", request.id, request);
    }
    return { outcome, message: failure.message };
  };

  if (!params.interactRef || params.result === "grant_rejected") {
    return fail({ kind: "grant_rejected", message: "You did not give permission on the wallet's page. No money moved." }, "declined", "declined");
  }
  if (!params.hash || !verifyInteractionHash(params.hash, session.clientNonce, session.finishNonce, params.interactRef, session.grantEndpoint)) {
    return fail({ kind: "invalid_request", message: "The reply from the wallet could not be verified. No money moved." }, "failed", "failed");
  }

  const pending = JSON.parse(open(session.sealed)) as { continueUri: string; continueToken: string };
  let token;
  try {
    token = await gateway("wallet").continueGrant({ ...pending, interactRef: params.interactRef });
  } catch (e) {
    return fail(failureFrom(e), "failed", "failed");
  }
  const secrets: CapSecrets = { accessToken: token.accessToken, manageUrl: token.manageUrl, continueUri: token.continueUri, continueToken: token.continueToken };

  if (session.purpose === "cap") {
    const now = Date.now();
    customer.cap = {
      limit: session.limit,
      interval: session.interval!,
      every: session.every!,
      status: "active",
      grantedAt: new Date(now).toISOString(),
      sealed: seal(JSON.stringify(secrets)),
      tokenExpiresAt: now + (token.expiresIn ?? 600) * 1000,
      spent: { period: periodKey(session.interval, now), value: "0" },
    };
    await store().put("customers", customer.id, customer);
    return { outcome: "cap_set" };
  }

  if (!request || request.status !== "consent") return { outcome: "failed", message: "That payment request is no longer open." };
  const done = await pay(customer, request, secrets.accessToken);
  return done.status === "paid" ? { outcome: "paid" } : { outcome: "failed", message: done.failure?.message };
}

export async function stopEverything(customer: Customer): Promise<void> {
  const cap = customer.cap;
  if (!cap || cap.status !== "active") throw new DomainError("wrong_state", "There is no active spending permission to stop.");
  const s = JSON.parse(open(cap.sealed)) as CapSecrets;
  await gateway("wallet").cancelGrant({ continueUri: s.continueUri, continueToken: s.continueToken });
  cap.status = "stopped";
  cap.stoppedAt = new Date().toISOString();
  await store().put("customers", customer.id, customer);
}

// ---------- wallet app: requests ----------

function isOpen(r: PaymentRequest): boolean {
  return r.status === "waiting" || r.status === "quoted";
}

async function expireIfDue(r: PaymentRequest): Promise<PaymentRequest> {
  if ((isOpen(r) || r.status === "consent") && Date.parse(r.expiresAt) < Date.now()) {
    r.status = "expired";
    r.failure = { kind: "expired", message: "This request ran out of time. No money moved." };
    r.approval = undefined;
    await store().put("requests", r.id, r);
  }
  return r;
}

function subjectOf(r: PaymentRequest) {
  const q = r.quote!;
  return { requestId: r.id, quoteId: q.id, debitValue: q.debitAmount.value, assetCode: q.debitAmount.assetCode, assetScale: q.debitAmount.assetScale };
}

/** The newest open request for this customer, priced by their own wallet. */
export async function pendingRequest(customer: Customer): Promise<PaymentRequest | null> {
  const mine = (await store().list<PaymentRequest>("requests"))
    .filter((r) => r.customerId === customer.id && isOpen(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const candidate of mine) {
    const r = await expireIfDue(candidate);
    if (!isOpen(r)) continue;
    const quoteStale = r.quote?.expiresAt ? Date.parse(r.quote.expiresAt) < Date.now() + 15_000 : false;
    if (r.status === "waiting" || quoteStale) {
      try {
        r.quote = await gateway("wallet").createQuote({ wallet: customer.wallet, incomingPaymentUrl: r.incomingPaymentUrl });
        r.status = "quoted";
        r.approval = issueChallenge(subjectOf(r));
      } catch (e) {
        r.status = "failed";
        r.failure = failureFrom(e);
        r.approval = undefined;
      }
      await store().put("requests", r.id, r);
    } else if (!r.approval || Date.parse(r.approval.expiresAt) < Date.now() + 15_000) {
      r.approval = issueChallenge(subjectOf(r));
      await store().put("requests", r.id, r);
    }
    return r;
  }
  return null;
}

export async function getRequestFor(customer: Customer, requestId: string): Promise<PaymentRequest> {
  const r = await store().get<PaymentRequest>("requests", requestId);
  if (!r || r.customerId !== customer.id) throw new DomainError("not_found", "That request does not exist.");
  return expireIfDue(r);
}

export async function latestFinished(customer: Customer): Promise<PaymentRequest | null> {
  const mine = (await store().list<PaymentRequest>("requests"))
    .filter((r) => r.customerId === customer.id && !isOpen(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mine[0] ? expireIfDue(mine[0]) : null;
}

export async function declineRequest(customer: Customer, requestId: string): Promise<PaymentRequest> {
  const r = await getRequestFor(customer, requestId);
  if (!isOpen(r)) throw new DomainError("wrong_state", "That request is no longer open.");
  r.status = "declined";
  r.approval = undefined;
  r.failure = { kind: "grant_rejected", message: "The customer said no. No money moved." };
  await store().put("requests", r.id, r);
  return r;
}

/**
 * Approve one request. With an active cap the payment is made now. Without one, the customer is
 * sent to the wallet's consent page for this single payment.
 */
export async function approveRequest(
  customer: Customer,
  requestId: string,
  proof: unknown,
  baseUrl: string,
): Promise<{ request: PaymentRequest; redirectUrl?: string }> {
  const r = await getRequestFor(customer, requestId);
  if (r.status !== "quoted" || !r.quote) throw new DomainError("wrong_state", r.failure?.message ?? "That request is no longer open.");
  if (hasFingerprint(customer)) {
    // A fingerprint is set up, so a tap alone is not enough.
    const p = (proof && typeof proof === "object" ? proof : {}) as Partial<ApprovalProof> & { signature?: unknown };
    if ((p.method !== "passkey" && p.method !== "device-key") || !challengeIsValid(subjectOf(r), r.approval, p.challenge)) {
      throw new DomainError("not_allowed", "This payment needs your fingerprint. Nothing was paid.");
    }
    if (p.method === "device-key") {
      const ok = (customer.deviceKeys ?? []).some((k) => verifyDeviceSignature(k.spki, r.approval!.challenge, p.signature));
      if (!ok) throw new DomainError("not_allowed", "The fingerprint check did not match this payment. Nothing was paid.");
    } else {
      const check = await verifyPasskeySignature({ baseUrl, approvalChallenge: r.approval!.challenge, passkeys: customer.passkeys ?? [], response: p.response });
      if (!check.ok) throw new DomainError("not_allowed", "The fingerprint check did not match this payment. Nothing was paid.");
      const used = customer.passkeys?.find((k) => k.id === check.passkeyId);
      if (used && typeof check.newCounter === "number") used.counter = check.newCounter;
      await store().put("customers", customer.id, customer);
    }
  } else if (!verifyApproval(subjectOf(r), r.approval, proof)) {
    throw new DomainError("not_allowed", "The approval did not match this payment. Nothing was paid.");
  }
  r.approval = undefined; // an approval is used once

  if (customer.cap?.status === "active") {
    r.status = "paying";
    r.consentBy = "cap";
    await store().put("requests", r.id, r);
    return { request: await payUnderCap(customer, r) };
  }

  r.status = "consent";
  r.consentBy = "once";
  await store().put("requests", r.id, r);
  try {
    const redirectUrl = await startGrant(customer, { purpose: "once", limit: r.quote.debitAmount, requestId: r.id }, baseUrl);
    return { request: r, redirectUrl };
  } catch (e) {
    r.status = "failed";
    r.failure = failureFrom(e);
    await store().put("requests", r.id, r);
    return { request: r };
  }
}

async function payUnderCap(customer: Customer, r: PaymentRequest): Promise<PaymentRequest> {
  const cap = customer.cap!;
  const secrets = JSON.parse(open(cap.sealed)) as CapSecrets;
  const g = gateway("wallet");

  const rotate = async () => {
    const t = await g.rotateToken({ manageUrl: secrets.manageUrl, accessToken: secrets.accessToken });
    secrets.accessToken = t.accessToken;
    secrets.manageUrl = t.manageUrl;
    cap.sealed = seal(JSON.stringify(secrets));
    cap.tokenExpiresAt = Date.now() + (t.expiresIn ?? 600) * 1000;
    await store().put("customers", customer.id, customer);
  };

  let rotated = false;
  try {
    if (cap.tokenExpiresAt - Date.now() < 60_000) {
      await rotate();
      rotated = true;
    }
  } catch (e) {
    r.status = "failed";
    r.failure = failureFrom(e);
    await store().put("requests", r.id, r);
    return r;
  }

  let done = await pay(customer, r, secrets.accessToken);
  if (done.status === "failed" && done.failure?.kind === "grant_rejected" && !rotated) {
    // The token may simply have aged out. Rotate once and try again before giving up.
    try {
      await rotate();
      done.status = "paying";
      done.failure = undefined;
      done = await pay(customer, done, secrets.accessToken);
    } catch {
      /* keep the first failure */
    }
  }
  return done;
}

async function pay(customer: Customer, r: PaymentRequest, accessToken: string): Promise<PaymentRequest> {
  const quote = r.quote!;
  const cap = customer.cap?.status === "active" && r.consentBy === "cap" ? customer.cap : undefined;
  try {
    const out = await gateway("wallet").createOutgoingPayment({ wallet: customer.wallet, accessToken, quoteId: quote.id, description: `Payment to ${r.merchantName}` });
    if (out.failed) throw new OpError("unknown", "The wallet marked this payment as failed.");
    const now = Date.now();
    r.status = "paid";
    r.failure = undefined;
    r.outgoingPaymentUrl = out.id;
    r.paid = { debitAmount: out.debitAmount, receiveAmount: out.receiveAmount, at: new Date(now).toISOString() };
    if (cap) {
      const period = periodKey(cap.interval, now);
      const before = cap.spent.period === period ? BigInt(cap.spent.value) : BigInt(0);
      cap.spent = { period, value: (before + BigInt(out.debitAmount.value)).toString() };
      cap.walletReportedSpent = out.grantSpentDebitAmount;
    }
    const known = customer.contacts[r.merchantWalletId];
    customer.contacts[r.merchantWalletId] = {
      walletId: r.merchantWalletId,
      name: r.merchantName,
      paidCount: (known?.paidCount ?? 0) + 1,
      lastPaidAt: r.paid.at,
    };
    await store().put("customers", customer.id, customer);
  } catch (e) {
    const failure = failureFrom(e);
    // The wallet is the one refusing. If it did not say why, our own record can still tell the user the likely reason.
    if (cap && failure.kind === "grant_rejected" && exceedsCap(cap.limit, capSpent(cap), quote.debitAmount)) {
      failure.kind = "limit_exceeded";
      failure.message = `Your wallet refused this payment. It did not say why, but by our record it would take you over your limit of ${formatAmount(cap.limit)}.`;
    }
    r.status = "failed";
    r.failure = failure;
  }
  await store().put("requests", r.id, r);
  return r;
}

// ---------- history (payments made through this app only) ----------

const HISTORY_LIMIT = 20;

export async function customerHistory(customer: Customer) {
  const mine = (await store().list<PaymentRequest>("requests"))
    .filter((r) => r.customerId === customer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HISTORY_LIMIT);
  const out = [];
  for (const r of mine) {
    const current = await expireIfDue(r);
    if (current.status === "waiting" || current.status === "quoted") continue; // still open: shown as the request itself
    out.push(historyItem(current));
  }
  return out;
}

export async function merchantHistory() {
  const wallet = normalizeWalletUrl(merchantWalletUrl());
  const customers = await store().list<Customer>("customers");
  const mine = (await store().list<PaymentRequest>("requests"))
    .filter((r) => normalizeWalletUrl(r.merchantWalletId) === wallet)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HISTORY_LIMIT);
  return mine.map((r) => {
    const h = historyItem(r);
    return {
      id: h.id,
      at: h.at,
      status: h.status,
      requested: h.requested,
      receiveAmount: h.status === "paid" ? h.receiveAmount : undefined,
      reason: sellerReason(h.status),
      customerName: customers.find((c) => c.id === r.customerId)?.wallet.publicName ?? "Customer",
      customerPayCode: r.customerPayCode,
    };
  });
}

function historyItem(r: PaymentRequest) {
  const open = r.status === "waiting" || r.status === "quoted" || r.status === "consent" || r.status === "paying";
  const expired = open && Date.parse(r.expiresAt) < Date.now();
  return {
    id: r.id,
    at: r.paid?.at ?? r.createdAt,
    merchantName: r.merchantName,
    status: expired ? ("expired" as const) : r.status,
    requested: r.requested,
    debitAmount: r.paid?.debitAmount ?? r.quote?.debitAmount,
    receiveAmount: r.paid?.receiveAmount ?? r.quote?.receiveAmount,
    approvedVia: r.status === "paid" ? (r.consentBy === "cap" ? ("limit" as const) : ("wallet-page" as const)) : undefined,
    failure: r.failure ? { kind: r.failure.kind, message: r.failure.message, walletSaid: r.failure.walletSaid } : undefined,
  };
}

// ---------- what a browser is allowed to see ----------

export function publicRequest(r: PaymentRequest, customer: Customer) {
  const known = customer.contacts[r.merchantWalletId];
  return {
    id: r.id,
    status: r.status,
    merchantName: r.merchantName,
    knownPayee: Boolean(known),
    timesPaidBefore: known?.paidCount ?? 0,
    requested: r.requested,
    debitAmount: r.quote?.debitAmount,
    receiveAmount: r.quote?.receiveAmount,
    challenge: r.status === "quoted" ? r.approval?.challenge : undefined,
    deviceChallenge: r.status === "quoted" && r.approval ? approvalChallengeForDevice(r.approval.challenge) : undefined,
    paid: r.paid,
    failure: r.failure,
    expiresAt: r.expiresAt,
    needsWalletConsent: customer.cap?.status !== "active",
  };
}

export function publicCustomer(c: Customer) {
  return {
    payCode: c.payCode,
    walletAddress: c.wallet.id,
    name: c.wallet.publicName ?? null,
    assetCode: c.wallet.assetCode,
    assetScale: c.wallet.assetScale,
    cap: capSummary(c.cap),
    fingerprint: [
      ...(c.passkeys ?? []).map((p) => ({ kind: "passkey" as const, id: p.id, transports: p.transports, createdAt: p.createdAt })),
      ...(c.deviceKeys ?? []).map((k) => ({ kind: "device" as const, id: k.id, createdAt: k.createdAt })),
    ],
  };
}

// ---------- wallet app: fingerprint ----------

export async function startFingerprintSetup(customer: Customer, baseUrl: string) {
  // Once set, it stays: otherwise someone holding the unlocked device could swap it out.
  if (hasFingerprint(customer)) throw new DomainError("wrong_state", "Your fingerprint is already set up.");
  const { options, pending } = await registrationOptions({
    baseUrl,
    userId: customer.id,
    userName: customer.wallet.publicName ?? "Pay Alone customer",
    existing: customer.passkeys ?? [],
  });
  customer.passkeyRegistration = pending;
  await store().put("customers", customer.id, customer);
  return options;
}

export async function finishFingerprintSetup(customer: Customer, response: unknown, baseUrl: string) {
  const passkey = await finishRegistration({ baseUrl, pending: customer.passkeyRegistration, response });
  customer.passkeyRegistration = undefined;
  if (!passkey) {
    await store().put("customers", customer.id, customer);
    throw new DomainError("not_allowed", "The fingerprint could not be set up. Please try again.");
  }
  customer.passkeys = [...(customer.passkeys ?? []), passkey];
  await store().put("customers", customer.id, customer);
}

/** Native app setup, step 1: a challenge the app must sign with its new key (Touch ID prompt). */
export async function startDeviceKeySetup(customer: Customer) {
  if (hasFingerprint(customer)) throw new DomainError("wrong_state", "Your fingerprint is already set up.");
  const challenge = `setup.${randomToken(24)}`;
  customer.deviceKeyChallenge = { challenge, expiresAt: new Date(Date.now() + 2 * 60_000).toISOString() };
  await store().put("customers", customer.id, customer);
  return challenge;
}

/** Native app setup, step 2: save the public key once the app proves it can sign with it. */
export async function finishDeviceKeySetup(customer: Customer, publicKey: unknown, signature: unknown) {
  const pending = customer.deviceKeyChallenge;
  customer.deviceKeyChallenge = undefined;
  if (hasFingerprint(customer)) throw new DomainError("wrong_state", "Your fingerprint is already set up.");
  const spki = typeof publicKey === "string" ? spkiFromX963(publicKey) : null;
  if (!pending || Date.parse(pending.expiresAt) < Date.now() || !spki || !verifyDeviceSignature(spki, pending.challenge, signature)) {
    await store().put("customers", customer.id, customer);
    throw new DomainError("not_allowed", "The fingerprint could not be set up. Please try again.");
  }
  customer.deviceKeys = [{ id: sha256(spki).slice(0, 16), spki, createdAt: new Date().toISOString() }];
  await store().put("customers", customer.id, customer);
}
