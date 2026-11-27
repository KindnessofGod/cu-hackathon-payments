// Hosted voices, chosen from the owner's voice test (KindnessofGod/ai-voice-demo):
//   Igbo -> Spitch (ElevenLabs does not speak Igbo); everything else -> ElevenLabs, with the other as backup.
// Keys come from environment variables on the server and are never sent to a browser or logged.
import Spitch from "spitch";
import type { Lang } from "./sentences";

const TIMEOUT_MS = 8000;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const ELEVEN_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_v4";
const ELEVEN_LANG: Record<Lang, string | undefined> = { en: "en", pcm: "en", yo: "yo", ha: "ha", ig: undefined };
const SPITCH_VOICE: Partial<Record<Lang, "lucy" | "sade" | "amina" | "ngozi">> = { en: "lucy", yo: "sade", ha: "amina", ig: "ngozi" };

type Provider = "elevenlabs" | "spitch";
const ORDER: Record<Lang, Provider[]> = {
  ig: ["spitch", "elevenlabs"],
  pcm: ["elevenlabs"], // Spitch has no Pidgin voice
  en: ["elevenlabs", "spitch"],
  yo: ["elevenlabs", "spitch"],
  ha: ["elevenlabs", "spitch"],
};

async function eleven(text: string, lang: Lang, own?: string): Promise<ArrayBuffer> {
  const key = own ?? process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("no key");
  const call = (languageCode?: string) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: ELEVEN_MODEL, ...(languageCode ? { language_code: languageCode } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  let res = await call(ELEVEN_LANG[lang]);
  if (res.status === 400 || res.status === 422) res = await call(undefined); // language not accepted: let the model infer it
  if (!res.ok) throw new Error(`elevenlabs ${res.status}`);
  return res.arrayBuffer();
}

async function spitch(text: string, lang: Lang): Promise<ArrayBuffer> {
  const voice = SPITCH_VOICE[lang];
  if (!process.env.SPITCH_API_KEY || !voice) throw new Error("not available");
  const client = new Spitch({ apiKey: process.env.SPITCH_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  const res = await client.speech.generate({ text, voice, language: lang, format: "mp3" });
  return res.arrayBuffer();
}

/** Returns MP3 audio and which service made it, or throws if every service failed. */
export async function synthesize(text: string, lang: Lang, opts: { elevenKey?: string } = {}): Promise<{ audio: ArrayBuffer; provider: Provider }> {
  const errors: string[] = [];
  // A visitor's own key powers ElevenLabs only; the owner's Spitch credits are never used for them.
  for (const p of opts.elevenKey ? ORDER[lang].filter((x) => x === "elevenlabs") : ORDER[lang]) {
    try {
      return { audio: p === "spitch" ? await spitch(text, lang) : await eleven(text, lang, opts.elevenKey), provider: p };
    } catch (e) {
      errors.push(`${p}: ${e instanceof Error ? e.message.slice(0, 80) : "failed"}`);
    }
  }
  throw new Error(errors.join("; "));
}

// ---------- listening (speech to text) ----------
// Spitch first for Yoruba, Igbo and Hausa (built for Nigerian languages); ElevenLabs first for English
// and Pidgin. Either one backs up the other.
const ELEVEN_STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";
const ELEVEN_STT_LANG: Record<Lang, string | undefined> = { en: "eng", pcm: undefined, yo: "yor", ig: "ibo", ha: "hau" };
const STT_ORDER: Record<Lang, Provider[]> = {
  en: ["elevenlabs", "spitch"],
  pcm: ["elevenlabs", "spitch"],
  yo: ["spitch", "elevenlabs"],
  ig: ["spitch", "elevenlabs"],
  ha: ["spitch", "elevenlabs"],
};

async function elevenHear(wav: Uint8Array, lang: Lang, own?: string): Promise<string> {
  const key = own ?? process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("no key");
  const call = (languageCode?: string) => {
    const form = new FormData();
    form.append("model_id", ELEVEN_STT_MODEL);
    form.append("file", new Blob([wav as BlobPart], { type: "audio/wav" }), "answer.wav");
    form.append("tag_audio_events", "false");
    if (languageCode) form.append("language_code", languageCode);
    return fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  };
  let res = await call(ELEVEN_STT_LANG[lang]);
  if (res.status === 400 || res.status === 422) res = await call(undefined);
  if (!res.ok) throw new Error(`elevenlabs ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

async function spitchHear(wav: Uint8Array, lang: Lang): Promise<string> {
  if (!process.env.SPITCH_API_KEY) throw new Error("not available");
  const client = new Spitch({ apiKey: process.env.SPITCH_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  const res = await client.speech.transcribe({ content: new File([wav as BlobPart], "answer.wav", { type: "audio/wav" }), language: lang === "pcm" ? "en" : lang });
  return res.text ?? "";
}

/** Returns what was said and which service heard it, or throws if every service failed. */
export async function transcribe(wav: Uint8Array, lang: Lang, opts: { elevenKey?: string } = {}): Promise<{ text: string; provider: Provider }> {
  const errors: string[] = [];
  for (const p of opts.elevenKey ? STT_ORDER[lang].filter((x) => x === "elevenlabs") : STT_ORDER[lang]) {
    try {
      return { text: p === "spitch" ? await spitchHear(wav, lang) : await elevenHear(wav, lang, opts.elevenKey), provider: p };
    } catch (e) {
      errors.push(`${p}: ${e instanceof Error ? e.message.slice(0, 80) : "failed"}`);
    }
  }
  throw new Error(errors.join("; "));
}
