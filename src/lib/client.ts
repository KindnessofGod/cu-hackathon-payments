// Browser-side helpers shared by both apps. No secrets ever reach this file.
import type { Amount } from "./money";

export interface ApiError {
  kind: string;
  message: string;
  walletSaid?: string;
}

export class ApiFailure extends Error {
  constructor(public error: ApiError) {
    super(error.message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiFailure({ kind: "offline", message: "No connection. Check the internet and try again." });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new ApiFailure(data?.error ?? { kind: "unknown", message: "Something went wrong." });
  return data as T;
}

export function errorText(e: unknown): ApiError {
  return e instanceof ApiFailure ? e.error : { kind: "unknown", message: "Something went wrong." };
}

export type { Amount };
