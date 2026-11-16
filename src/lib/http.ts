import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { customerFromDeviceToken, DomainError, type Customer } from "./domain";
import { OpError } from "./op";

export const DEVICE_COOKIE = "cw_device";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}

/** One error shape for every route: { error: { kind, message, walletSaid? } } */
export function fail(e: unknown) {
  if (e instanceof DomainError) {
    const status = { not_found: 404, bad_input: 400, not_allowed: 403, wrong_state: 409 }[e.code];
    return ok({ error: { kind: e.code, message: e.message } }, { status });
  }
  if (e instanceof OpError) {
    const d = e.detail;
    const walletSaid = d ? [d.status, d.code, d.description].filter(Boolean).join(" ") || undefined : undefined;
    const status = e.kind === "wallet_unreachable" ? 503 : e.kind === "not_found" ? 404 : 502;
    return ok({ error: { kind: e.kind, message: e.message, walletSaid } }, { status });
  }
  console.error("Unexpected error:", e instanceof Error ? e.message : e);
  return ok({ error: { kind: "unknown", message: "Something went wrong on our side." } }, { status: 500 });
}

export async function baseUrl(): Promise<string> {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function currentCustomer(): Promise<Customer | null> {
  return customerFromDeviceToken((await cookies()).get(DEVICE_COOKIE)?.value);
}

export async function requireCustomer(): Promise<Customer> {
  const c = await currentCustomer();
  if (!c) throw new DomainError("not_allowed", "This device is not set up yet.");
  return c;
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
