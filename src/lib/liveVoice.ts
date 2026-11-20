// A live, two-way voice conversation with the Pay Alone agent (ElevenLabs Agents).
// The server gives a one-time token (WebRTC) and a signed URL (WebSocket) plus the facts from our records.
// WebRTC is tried first; if it does not connect within a few seconds (VPNs, strict networks), the same
// conversation is opened over a WebSocket. The agent cannot move money; the fingerprint approves.
import { Conversation, stripAudioTags, type VoiceConversation } from "@elevenlabs/client";

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

/**
 * Saves the conversation in our own database, line by line and in order. Lines said before the
 * conversation has its id are held until it does.
 */
function transcriptLog() {
  let id = "";
  const held: { who: "you" | "app" | "tool"; text: string }[] = [];
  let chain = Promise.resolve();
  const send = (who: "you" | "app" | "tool", text: string) => {
    chain = chain
      .then(() =>
        fetch("/api/voice/transcript", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId: id, who, text }),
        }).then(() => undefined),
      )
      .catch(() => undefined);
  };
  return {
    setId(newId: string) {
      id = newId;
      for (const l of held.splice(0)) send(l.who, l.text);
    },
    add(who: "you" | "app" | "tool", text: string) {
      if (id) send(who, text);
      else held.push({ who, text });
    },
  };
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

async function open(
  o: LiveOptions,
  s: Start,
  via: "webrtc" | "websocket",
  live: { connected: boolean },
  log: ReturnType<typeof transcriptLog>,
): Promise<VoiceConversation> {
  // Every tool call and its result go into our own transcript too.
  const tools: Record<string, (p: Record<string, unknown>) => Promise<string>> = {};
  for (const [name, fn] of Object.entries(o.tools ?? {})) {
    tools[name] = async (p) => {
      log.add("tool", `${name}(${JSON.stringify(p ?? {})})`);
      const result = await fn(p ?? {});
      log.add("tool", `${name} -> ${result}`);
      return result;
    };
  }
  const common = {
    onConnect: ({ conversationId }: { conversationId: string }) => log.setId(conversationId),
    textOnly: false,
    dynamicVariables: s.dynamicVariables,
    // The opening sentence comes from the first_message dynamic variable; only the language is overridden.
    overrides: { agent: { language: s.language as never } },
    clientTools: tools,
    onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => o.onMode(mode),
    onMessage: (m: { message: string; role: "user" | "agent" }) => {
      // Tone tags such as [happy] shape the voice; they are not shown as words.
      const text = m.role === "agent" ? stripAudioTags(m.message ?? "").replace(/\s{2,}/g, " ").trim() : (m.message ?? "");
      if (text) {
        o.onLine(m.role === "user" ? "you" : "app", text);
        log.add(m.role === "user" ? "you" : "app", m.message ?? "");
      }
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

/** Three rising notes (under a second), made in the browser: no file to load. Loud on purpose:
 * while the microphone is open the iPad plays sound quieter, and small speakers carry high notes best. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();
    const comp = ctx.createDynamicsCompressor(); // lets the notes run hot without crackling
    comp.threshold.value = -6;
    comp.ratio.value = 12;
    comp.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.02;
    [
      [1047, 0],
      [1319, 0.18],
      [1568, 0.36],
    ].forEach(([hz, at]) => {
      for (const type of ["triangle", "square"] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = hz;
        const peak = type === "triangle" ? 1 : 0.25;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + at + 0.015);
        gain.gain.setValueAtTime(peak, t0 + at + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.4);
        osc.connect(gain).connect(comp);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.42);
      }
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // no sound possible here
  }
}

/**
 * Safari may hold back the agent's audio when the conversation started without a tap (the app
 * opened it by itself). Any tap anywhere calls this: it resumes sound and plays held-back audio.
 */
export function nudgeAudio(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume().finally(() => setTimeout(() => void ctx.close(), 500));
  } catch {}
  document.querySelectorAll("audio").forEach((a) => {
    if (a.paused) void a.play().catch(() => undefined);
  });
}

/** Starts the conversation: WebRTC first, then WebSocket; in the chosen language, then English. */
export async function startLive(o: LiveOptions): Promise<LiveSession> {
  o.onMode("connecting");
  const mic = unlockAudio(); // must start before any await, while the tap still counts
  const stream = await mic;
  if (!stream) throw new Error("microphone not allowed");
  // A chime the moment Pay Alone wakes, so a blind user knows it opened before the voice connects.
  // Played while the microphone is open: Safari lets a page that is listening make sound without a tap.
  chime();
  setTimeout(() => stream.getTracks().forEach((t) => t.stop()), 800); // permission is granted now; the SDK opens its own

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
        conv = await open(o, s, via, live, transcriptLog());
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
