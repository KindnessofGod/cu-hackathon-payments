// A live, two-way voice conversation about one payment request, using ElevenLabs Agents over WebRTC.
// The server gives a one-time token and the facts (names and amounts from our records and the quote).
// The agent has two tools, both run here in the browser: approve_payment opens the fingerprint prompt,
// refuse_payment refuses. The agent cannot move money; the fingerprint and the wallet do that.
import { Conversation, type VoiceConversation } from "@elevenlabs/client";

export type LiveMode = "connecting" | "listening" | "speaking";

export type LiveSession = {
  end: () => Promise<void>;
  /** 0..1 loudness of the customer's microphone and of the agent's voice, for the moving orb. */
  levels: () => { input: number; output: number };
};

export type LiveOptions = {
  requestId: string;
  lang: string;
  native: boolean;
  onMode: (m: LiveMode) => void;
  onLine: (who: "you" | "app", text: string) => void;
  onEnd: (reason: "agent" | "user" | "error", message?: string) => void;
  approve: () => Promise<string>;
  refuse: () => Promise<string>;
};

type Start = { token: string; language: string; dynamicVariables: Record<string, string> };

async function fetchStart(o: LiveOptions, lang: string): Promise<Start> {
  const res = await fetch(`/api/voice/agent?id=${encodeURIComponent(o.requestId)}&lang=${lang}&native=${o.native ? "1" : "0"}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`live voice unavailable (${res.status})`);
  return (await res.json()) as Start;
}

async function open(o: LiveOptions, s: Start): Promise<VoiceConversation> {
  return (await Conversation.startSession({
    conversationToken: s.token,
    connectionType: "webrtc",
    textOnly: false,
    dynamicVariables: s.dynamicVariables,
    overrides: { agent: { language: s.language as never, firstMessage: s.dynamicVariables.first_message } },
    clientTools: {
      approve_payment: () => o.approve(),
      refuse_payment: () => o.refuse(),
    },
    onModeChange: ({ mode }) => o.onMode(mode),
    onMessage: (m) => {
      if (m.message) o.onLine(m.role === "user" ? "you" : "app", m.message);
    },
    onDisconnect: (d) => o.onEnd(d.reason, d.reason === "error" ? d.message : undefined),
    onError: (message) => console.error("live voice:", message),
  })) as VoiceConversation;
}

/** Starts the conversation. If the chosen language fails to start, tries English once. */
export async function startLive(o: LiveOptions): Promise<LiveSession> {
  o.onMode("connecting");
  let conv: VoiceConversation;
  try {
    conv = await open(o, await fetchStart(o, o.lang));
  } catch (e) {
    if (o.lang === "en") throw e;
    conv = await open(o, await fetchStart(o, "en"));
  }
  return {
    end: () => conv.endSession(),
    levels: () => ({ input: conv.getInputVolume(), output: conv.getOutputVolume() }),
  };
}
