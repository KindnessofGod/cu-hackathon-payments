// A live, two-way voice conversation with the Pay Alone agent (ElevenLabs Agents).
// The server gives a one-time token (WebRTC) and a signed URL (WebSocket) plus the facts from our records.
// WebRTC is tried first; if it does not connect within a few seconds (VPNs, strict networks), the same
// conversation is opened over a WebSocket. The agent cannot move money; the fingerprint approves.
import { Conversation, stripAudioTags, type VoiceConversation } from "@elevenlabs/client";
import { stageSend } from "./stage";

export type LiveMode = "connecting" | "listening" | "speaking";

export type LiveSession = {
  end: () => Promise<void>;
  /** 0..1 loudness of the customer's microphone and of the agent's voice, for the moving orb. */
  levels: () => { input: number; output: number };
  /** Tells the agent something new without making it speak (e.g. what is left after a payment). */
  context: (text: string) => void;
  /** Sends a message as if from the customer's side, so the agent answers it now (app notices). */
  nudge: (text: string) => void;
  /** Re-opens the microphone and wakes the sound (after the fingerprint sheet, or when the mic went silent). */
  refreshAudio: (why: string) => Promise<void>;
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

/** How long the microphone stays off after Pay Alone stops speaking, in stage mode (hall delay plus echo). */
const STAGE_TAIL_MS = 1500;

/** Stage mode is switched on with /wallet?stage=1 and off with ?stage=0; this device remembers it. */
export function stageMode(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("stage");
    if (q === "1") localStorage.setItem("payalone-stage", "1");
    if (q === "0") localStorage.removeItem("payalone-stage");
    return localStorage.getItem("payalone-stage") === "1";
  } catch {
    return false;
  }
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
  // Stage mode forwards the agent's voice to the studio. The microphone used to be muted while Pay Alone
  // spoke (and 1.5 s after) against hall echo, but the studio is far from the iPad: the gate only cut off
  // the customer's first words and stopped interruptions, so it is off. MIC_GATE turns it back on.
  const stage = stageMode();
  const MIC_GATE = false;
  const gate = {
    conv: null as VoiceConversation | null,
    mode: "listening" as "speaking" | "listening",
    fmt: via === "webrtc" ? "pcm_48000" : "pcm_16000",
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    apply() {
      if (!stage || !MIC_GATE || !gate.conv) return;
      clearTimeout(gate.timer);
      if (gate.mode === "speaking") gate.conv.setMicMuted(true);
      else gate.timer = setTimeout(() => gate.conv?.setMicMuted(false), STAGE_TAIL_MS);
    },
  };
  const common = {
    onConnect: ({ conversationId }: { conversationId: string }) => log.setId(conversationId),
    textOnly: false,
    dynamicVariables: s.dynamicVariables,
    // The opening sentence comes from the first_message dynamic variable; only the language is overridden.
    overrides: { agent: { language: s.language as never } },
    clientTools: tools,
    // Stage mode: the agent's own voice also goes to the studio page (same audio, no second call).
    ...(stage
      ? {
          onAudio: (b64: string) => stageSend("audio", { b64, fmt: gate.fmt }),
          onConversationMetadata: (m: { agent_output_audio_format?: string }) => {
            if (m?.agent_output_audio_format) gate.fmt = m.agent_output_audio_format;
          },
          onInterruption: () => stageSend("flush", {}),
        }
      : {}),
    onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => {
      o.onMode(mode);
      gate.mode = mode;
      gate.apply();
    },
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
  const conv = (await withTimeout(start, via === "webrtc" ? 9000 : 12000, (late) => void late.endSession())) as VoiceConversation;
  gate.conv = conv;
  gate.apply();
  return conv;
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

/** A short, happy "paid" sound: a rising major arpeggio with a sparkle on top (about 1.2 s). */
export function successChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.ratio.value = 10;
    comp.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.02;
    const notes: [number, number, number][] = [
      [784, 0, 0.35], // G5
      [988, 0.11, 0.35], // B5
      [1175, 0.22, 0.4], // D6
      [1568, 0.36, 0.9], // G6, held
      [2349, 0.36, 0.7], // sparkle
    ];
    for (const [hz, at, len] of notes) {
      for (const type of ["triangle", "sine"] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = hz;
        const peak = (type === "triangle" ? 0.7 : 0.35) * (hz > 2000 ? 0.4 : 1);
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
        osc.connect(gain).connect(comp);
        osc.start(t0 + at);
        osc.stop(t0 + at + len + 0.05);
      }
    }
    setTimeout(() => void ctx.close(), 1600);
  } catch {
    // no sound possible here
  }
  stageSend("ding", {});
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
  const stage = stageMode();
  // The normal (echo-cancelled) microphone also in stage mode: the plain one was too quiet to hear the
  // customer, and the studio gets the voice from the forwarded audio, not from a screen broadcast.
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
    for (const via of stage ? (["websocket", "webrtc"] as const) : (["webrtc", "websocket"] as const)) {
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
    nudge: (text: string) => c.sendUserMessage(text),
    refreshAudio: async (why: string) => {
      // iPadOS can pause a page's audio when a system sheet (Touch ID) appears; it does not always come back.
      const inner = c as unknown as { input?: { context?: AudioContext }; output?: { context?: AudioContext } };
      for (const ctx of [inner.input?.context, inner.output?.context]) {
        try {
          if (ctx && ctx.state !== "running") await ctx.resume();
        } catch {
          // keep going
        }
      }
      try {
        await c.changeInputDevice({});
      } catch (e) {
        report(`mic refresh failed (${why})`, e);
        return;
      }
      report(`mic refreshed (${why})`);
    },
  };
}
