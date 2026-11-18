// A live, two-way voice conversation with the Pay Alone agent (ElevenLabs Agents).
// The server gives a one-time token (WebRTC) and a signed URL (WebSocket) plus the facts from our records.
// WebRTC is tried first; if it does not connect within a few seconds (VPNs, strict networks), the same
// conversation is opened over a WebSocket. The agent cannot move money; the fingerprint approves.
import { Conversation, type VoiceConversation } from "@elevenlabs/client";

export type LiveMode = "connecting" | "listening" | "speaking";

export type LiveSession = {
  end: () => Promise<void>;
  /** 0..1 loudness of the customer's microphone and of the agent's voice, for the moving orb. */
  levels: () => { input: number; output: number };
  /** Tells the agent something new without making it speak (e.g. what is left after a payment). */
  context: (text: string) => void;
};

export type LiveOptions = {
  /** Server route that returns the token and facts, e.g. /api/voice/agent?id=… (lang is added). */
  startUrl: string;
  lang: string;
  onMode: (m: LiveMode) => void;
  onLine: (who: "you" | "app", text: string) => void;
  onEnd: (reason: "agent" | "user" | "error", message?: string) => void;
  /** Client tools the agent may call. */
  tools?: Record<string, (params: Record<string, unknown>) => Promise<string>>;
};

type Start = { token?: string; signedUrl?: string; language: string; dynamicVariables: Record<string, string> };

/** Sends a short error report to the server log, so failures on the customer's device can be seen. */
export function report(what: string, e?: unknown) {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : e === undefined ? "" : String(e);
  void fetch("/api/voice/debug", { method: "POST", body: `${what} ${msg} | ${navigator.userAgent}`.slice(0, 600) }).catch(() => {});
}

async function fetchStart(o: LiveOptions, lang: string): Promise<Start> {
  const sep = o.startUrl.includes("?") ? "&" : "?";
  const res = await fetch(`${o.startUrl}${sep}lang=${lang}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`live voice unavailable (${res.status})`);
  return (await res.json()) as Start;
}

function withTimeout<T>(p: Promise<T>, ms: number, onLate: (v: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      done = true;
      reject(new Error(`timed out after ${ms} ms`));
    }, ms);
    p.then(
      (v) => {
        if (done) return onLate(v);
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        if (done) return;
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function open(o: LiveOptions, s: Start, via: "webrtc" | "websocket", live: { connected: boolean }): Promise<VoiceConversation> {
  const common = {
    textOnly: false,
    dynamicVariables: s.dynamicVariables,
    overrides: { agent: { language: s.language as never, firstMessage: s.dynamicVariables.first_message } },
    clientTools: o.tools ?? {},
    onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => o.onMode(mode),
    onMessage: (m: { message: string; role: "user" | "agent" }) => {
      if (m.message) o.onLine(m.role === "user" ? "you" : "app", m.message);
    },
    onDisconnect: (d: { reason: "error" | "agent" | "user"; message?: string }) => {
      if (!live.connected) return; // a failed first attempt is not the end of the conversation
      o.onEnd(d.reason, d.reason === "error" ? d.message : undefined);
    },
    onError: (message: string) => report(`error (${via})`, message),
  };
  const start =
    via === "webrtc"
      ? Conversation.startSession({ ...common, conversationToken: s.token!, connectionType: "webrtc" })
      : Conversation.startSession({ ...common, signedUrl: s.signedUrl!, connectionType: "websocket" });
  // A late connection after we gave up is closed at once.
  return (await withTimeout(start, via === "webrtc" ? 9000 : 12000, (late) => void late.endSession())) as VoiceConversation;
}

/** iPad Safari only lets a page use sound and the microphone from a tap: unlock both right away. */
function unlockAudio(): Promise<MediaStream | null> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(0);
    void ctx.resume().finally(() => setTimeout(() => void ctx.close(), 500));
  } catch {
    // no sound unlock needed or possible
  }
  return navigator.mediaDevices?.getUserMedia({ audio: true }).catch((e) => {
    report("microphone", e);
    return null;
  }) ?? Promise.resolve(null);
}

/** Starts the conversation: WebRTC first, then WebSocket; in the chosen language, then English. */
export async function startLive(o: LiveOptions): Promise<LiveSession> {
  o.onMode("connecting");
  const mic = unlockAudio(); // must start before any await, while the tap still counts
  const stream = await mic;
  stream?.getTracks().forEach((t) => t.stop()); // permission is granted now; the SDK opens its own
  if (!stream) throw new Error("microphone not allowed");

  const live = { connected: false };
  let conv: VoiceConversation | null = null;
  let lastError: unknown = null;
  for (const lang of o.lang === "en" ? ["en"] : [o.lang, "en"]) {
    let s: Start;
    try {
      s = await fetchStart(o, lang);
    } catch (e) {
      lastError = e;
      report("start route", e);
      continue;
    }
    for (const via of ["webrtc", "websocket"] as const) {
      if (via === "webrtc" && !s.token) continue;
      if (via === "websocket" && !s.signedUrl) continue;
      try {
        conv = await open(o, s, via, live);
        break;
      } catch (e) {
        lastError = e;
        report(`connect ${via} ${lang}`, e);
      }
    }
    if (conv) break;
  }
  if (!conv) throw lastError ?? new Error("live voice could not connect");
  live.connected = true; // from now on a disconnect ends the conversation
  const c = conv;
  return {
    end: () => c.endSession(),
    levels: () => ({ input: c.getInputVolume(), output: c.getOutputVolume() }),
    context: (text: string) => c.sendContextualUpdate(text),
  };
}
