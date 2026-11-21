"use client";
// The studio feed. The customer's device (in stage mode) sends what is happening — the request, the
// spoken words, a live copy of its screen and the agent's own voice audio — over a Supabase Realtime
// broadcast channel; /stage in the studio draws it. Nothing is stored. The channel name is a secret the
// server gives only to the customer's device and to devices holding the merchant key (/api/stage), so a
// stranger can neither watch nor inject anything into the studio screen.
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type StageEvent = "snap" | "mode" | "lines" | "audio" | "flush" | "level" | "prompt" | "ding" | "dom" | "head" | "scroll" | "finger";

/** The one studio channel: payalone.vercel.app/stage always shows the device that is in stage mode. */
export const LIVE_KEY = "live";

/** Asks the server for the studio channel's secret name. Null when this device may not use it. */
export async function stageChannelName(): Promise<{ channel: string } | { error: string; locked: boolean }> {
  try {
    const r = await fetch("/api/stage", { cache: "no-store" });
    const d = (await r.json().catch(() => null)) as { channel?: string; error?: { message?: string } } | null;
    if (r.ok && d?.channel) return { channel: d.channel };
    return { error: d?.error?.message ?? `HTTP ${r.status}`, locked: r.status === 403 };
  } catch {
    return { error: "offline", locked: false };
  }
}

let out: { key: string; chan: RealtimeChannel | null; ready: boolean; status: string } | null = null;

/** Opens the sending side (customer device in stage mode). */
export function stageOpen(key = LIVE_KEY, onError?: (why: string) => void): void {
  if (out?.key === key) return;
  const c = sb();
  if (!c) {
    onError?.("studio feed not configured");
    return;
  }
  if (out?.chan) void c.removeChannel(out.chan);
  const me = { key, chan: null as RealtimeChannel | null, ready: false, status: "connecting" };
  out = me as typeof out;
  void stageChannelName().then((n) => {
    if (out !== (me as typeof out)) return;
    if ("error" in n) {
      me.status = `no channel (${n.error})`;
      onError?.(me.status);
      return;
    }
    const chan = c.channel(`stage-${n.channel}`, { config: { broadcast: { self: false, ack: false } } });
    me.chan = chan;
    chan.subscribe((s, err) => {
      me.ready = s === "SUBSCRIBED";
      me.status = s;
      if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") onError?.(`${s} ${err?.message ?? ""}`);
    });
  });
}

/** "SUBSCRIBED" when the studio feed is being sent; "" when stage mode never opened it. */
export function stageStatus(): string {
  return out?.status ?? "";
}

/** Sends one event to the studio; does nothing when stage mode is off or not connected. */
export function stageSend(event: StageEvent, payload: Record<string, unknown>): void {
  if (!out?.ready || !out.chan) return;
  void out.chan.send({ type: "broadcast", event, payload }).catch(() => {});
}

/** The studio side: listens to every event of one channel (its secret name). Returns a stop function. */
export function stageListen(
  channel: string,
  on: (event: StageEvent, payload: Record<string, unknown>) => void,
  status: (s: string) => void,
): () => void {
  const c = sb();
  if (!c) {
    status("not configured");
    return () => {};
  }
  const chan = c.channel(`stage-${channel}`, { config: { broadcast: { self: false } } });
  for (const e of ["snap", "mode", "lines", "audio", "flush", "level", "prompt", "ding", "dom", "head", "scroll", "finger"] as StageEvent[]) {
    chan.on("broadcast", { event: e }, (m) => on(e, (m.payload ?? {}) as Record<string, unknown>));
  }
  chan.subscribe((s) => status(s));
  return () => void c.removeChannel(chan);
}

type Brief = { id: string; merchantName: string; outgoing?: boolean; status: string; requested: unknown; debitAmount?: unknown; receiveAmount?: unknown; paid?: { debitAmount: unknown; receiveAmount: unknown } };

/** The parts of a payment request the studio shows. */
export function stageBrief(r: Brief | null): Record<string, unknown> | null {
  if (!r) return null;
  return {
    id: r.id,
    merchantName: r.merchantName,
    outgoing: Boolean(r.outgoing),
    status: r.status,
    amount: r.paid?.debitAmount ?? r.debitAmount ?? r.requested,
    receive: r.paid?.receiveAmount ?? r.receiveAmount ?? null,
  };
}
