// Voice cost experiment: does "hear → AI model with tools → speak, one turn at a time" really cost
// what Claude estimated (about ₦8-17 per back-and-forth, ₦25-50 per payment conversation), compared
// with the live ElevenLabs agent (₦143 for one real payment on 21 Nov)?
//
// Run:   npx tsx experiments/voice-cost/run.ts            (real APIs, needs keys in .env.local or env)
//        npx tsx experiments/voice-cost/run.ts --dry      (no network, checks the plumbing only)
// Options: --only=pay-simple,refuse   --no-cache   --tts-model=eleven_flash_v2_5
//
// Needs: ELEVENLABS_API_KEY, GEMINI_API_KEY. Optional: GEMINI_MODEL, ELEVENLABS_VOICE_ID,
// EXPERIMENT_USER_VOICE_ID (voice used to fake the customer), GEMINI_THINKING_BUDGET.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { intentOf } from "../../src/lib/voice/intent";
import { replySentence, howtoSentence, resultSentence, type Lang } from "../../src/lib/voice/sentences";
import { AGENT_BASELINE, PRICES, llmUsd, sttUsd, ttsUsd } from "./prices";
import { SCENARIOS, type Scenario } from "./scenarios";
import { MockWallet, TOOL_DECLARATIONS } from "./wallet";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
loadEnvFile(join(ROOT, ".env.local"));
loadEnvFile(join(ROOT, ".env"));

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const USE_CACHE = !args.includes("--no-cache");
const ONLY = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const TTS_MODEL = args.find((a) => a.startsWith("--tts-model="))?.slice(12) || process.env.ELEVENLABS_TTS_MODEL || "eleven_v4";
const STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";
const VOICE = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const USER_VOICE = process.env.EXPERIMENT_USER_VOICE_ID || VOICE;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const XI = process.env.ELEVENLABS_API_KEY || "";
const GK = process.env.GEMINI_API_KEY || "";

const ELEVEN_LANG: Record<Lang, string | undefined> = { en: "en", pcm: "en", yo: "yo", ha: "ha", ig: undefined };
const STT_LANG: Record<Lang, string | undefined> = { en: "eng", pcm: undefined, yo: "yor", ig: "ibo", ha: "hau" };

const AUDIO_DIR = join(HERE, "audio");
const CACHE_DIR = join(HERE, ".tts-cache");
const OUT_DIR = join(HERE, "results");
for (const d of [AUDIO_DIR, CACHE_DIR, OUT_DIR]) mkdirSync(d, { recursive: true });

const SYSTEM = `You are Pay Alone, a voice banking assistant for people who may be blind, elderly or unable to read.
Reply in the customer's language (English, Nigerian Pidgin, Yoruba or Hausa), in one or two short spoken sentences.
Rules:
- Never say an amount of money yourself when a tool result says the app already said it.
- Only call approve_payment after a clear yes to the waiting request. The fingerprint, not you, approves.
- Use payment_history or my_savings_and_investments to answer questions; do not guess numbers.
- If they are thinking or unsure, say something short and kind and wait. No tool.
- No markdown, no lists, no emojis: everything you write is spoken aloud.`;

type Turn = {
  scenario: string;
  turn: number;
  said: string;
  heard: string;
  path: "fast" | "ai";
  tools: string[];
  sttSeconds: number;
  ttsBilledChars: number;
  ttsCachedChars: number;
  llm: { input: number; cached: number; output: number; calls: number };
  ms: { stt: number; llm: number; tts: number; firstAudio: number };
  usd: { stt: number; llm: number; tts: number; total: number };
  spoken: string[];
};

const rows: Turn[] = [];
const dryCache = new Set<string>(); // dry run: remembers what would have been saved to disk
const setup = { userAudioChars: 0 };

async function main() {
  if (!DRY && (!XI || !GK)) {
    console.error("Missing ELEVENLABS_API_KEY or GEMINI_API_KEY. Put them in .env.local, or run with --dry to test the plumbing.");
    process.exit(1);
  }
  const scenarios = SCENARIOS.filter((s) => !ONLY || ONLY.includes(s.id));

  // 1. Make any missing customer recordings first, so their cost is kept out of the measurement.
  for (const s of scenarios) for (let i = 0; i < s.turns.length; i++) await userAudio(s, i);

  // 2. Credit balance before the measured run.
  const before = DRY ? null : await creditsUsed();
  const started = Date.now();
  for (const s of scenarios) await runScenario(s);
  const after = DRY ? null : await creditsUsed();

  report(scenarios, before, after, Date.now() - started);
}

async function runScenario(s: Scenario) {
  const wallet = new MockWallet(s.lang);
  const history: { role: "user" | "model"; parts: unknown[] }[] = [];
  // The seller's request arrives: the app speaks its own sentence. Counted as turn 0.
  if (s.request) {
    const t0 = blankTurn(s, 0, "(seller asks)");
    await speak(wallet.request(s.request.name, s.request.naira), s.lang, t0);
    finish(t0);
  }
  for (let i = 0; i < s.turns.length; i++) {
    const t = blankTurn(s, i + 1, s.turns[i]);
    // Hear.
    const audio = await userAudio(s, i);
    const sttStart = Date.now();
    t.sttSeconds = wavSeconds(audio);
    t.heard = DRY ? s.turns[i] : await transcribe(audio, s.lang);
    t.ms.stt = Date.now() - sttStart;

    // Route: a short, clear answer to a waiting request needs no AI.
    const intent = intentOf(t.heard, s.lang);
    const words = t.heard.trim().split(/\s+/).length;
    const llmStart = Date.now();
    let say: string[] = [];
    if (wallet.pending && intent !== "unclear" && words <= 6) {
      t.path = "fast";
      t.tools.push(intent);
      if (intent === "pay") say = wallet.run("approve_payment", {}).say;
      else if (intent === "refuse") say = wallet.run("refuse_payment", {}).say;
      else if (intent === "who" || intent === "left" || intent === "help")
        say = [replySentence(s.lang, intent, { name: wallet.pending.name, timesPaid: wallet.contacts[wallet.pending.name] ?? 0, left: wallet.left(), limit: wallet.limit })];
      else say = [howtoSentence(s.lang, "finger")];
      history.push({ role: "user", parts: [{ text: t.heard }] }, { role: "model", parts: [{ text: say.join(" ") }] });
    } else {
      t.path = "ai";
      say = await think(t, wallet, history);
    }
    t.ms.llm = Date.now() - llmStart;

    // Speak.
    await speak(say, s.lang, t);
    finish(t);
  }
}

/** One AI turn with function calling: up to four rounds of tool calls, then the spoken reply. */
async function think(t: Turn, wallet: MockWallet, history: { role: "user" | "model"; parts: unknown[] }[]): Promise<string[]> {
  const say: string[] = [];
  history.push({ role: "user", parts: [{ text: `[Facts now]\n${wallet.facts()}\n[Customer said] ${t.heard}` }] });
  for (let round = 0; round < 4; round++) {
    const res = DRY ? fakeGemini(t.heard, history) : await gemini(history);
    t.llm.calls++;
    t.llm.input += res.usage.input;
    t.llm.cached += res.usage.cached;
    t.llm.output += res.usage.output;
    history.push({ role: "model", parts: res.parts });
    const calls = res.parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall as { name: string; args?: Record<string, unknown> });
    const text = res.parts.filter((p: any) => typeof p.text === "string" && !p.thought).map((p: any) => p.text as string).join(" ").trim();
    if (!calls.length) {
      if (text) say.push(text);
      break;
    }
    const replies = calls.map((c) => {
      t.tools.push(c.name);
      const out = wallet.run(c.name, c.args ?? {});
      say.push(...out.say);
      return { functionResponse: { name: c.name, response: { result: out.result } } };
    });
    history.push({ role: "user", parts: replies });
  }
  // Keep the conversation short: the last 8 messages are enough for follow-ups.
  if (history.length > 8) history.splice(0, history.length - 8);
  return say;
}

async function gemini(history: { role: string; parts: unknown[] }[]) {
  const generationConfig: Record<string, unknown> = { temperature: 0.3, maxOutputTokens: 300 };
  if (process.env.GEMINI_THINKING_BUDGET) generationConfig.thinkingConfig = { thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET) };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": GK },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: history, tools: [{ functionDeclarations: TOOL_DECLARATIONS }], generationConfig }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as any;
  const u = data.usageMetadata ?? {};
  return {
    parts: (data.candidates?.[0]?.content?.parts ?? []) as any[],
    // Thinking tokens are billed as output, so they are counted as output here.
    usage: { input: u.promptTokenCount ?? 0, cached: u.cachedContentTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) },
  };
}

/** Dry run only: pretends to be the AI with simple rules, so the plumbing can be tested offline. */
function fakeGemini(heard: string, history: { role: string; parts: unknown[] }[]) {
  const last = history[history.length - 1];
  const afterTool = (last.parts as any[]).some((p) => p.functionResponse);
  const h = heard.toLowerCase();
  const tokens = Math.round(JSON.stringify(history).length / 4) + Math.round(SYSTEM.length / 4) + 600; // + tool list
  const usage = { input: tokens, cached: 0, output: 30 };
  if (afterTool) {
    const tool = (last.parts as any[])[0]?.functionResponse?.name;
    const text = tool === "payment_history" ? "This week you spent about seventeen thousand naira: Mama Chris twice and Chioma once."
      : tool === "my_savings_and_investments" ? "You have two thousand five hundred naira in savings, and your practice Dangote shares are worth about thirty thousand naira."
      : tool === "send_money" ? "" : "";
    return { parts: [{ text }], usage: { input: usage.input, cached: 0, output: 40 } };
  }
  const call = (name: string, args: Record<string, unknown> = {}) => ({ parts: [{ functionCall: { name, args } }], usage });
  if (/send .* to (\w+)/.test(h)) return call("send_money", { contact_name: h.match(/to (\w+)/)![1], amount_naira: 5000 });
  if (/spend|pay pass/.test(h)) return call("payment_history");
  if (/savings|shares/.test(h)) return call("my_savings_and_investments");
  if (/save/.test(h)) return { parts: [{ functionCall: { name: "approve_payment", args: {} } }, { functionCall: { name: "save_money", args: { amount_naira: 2000 } } }], usage };
  if (/settle|sanwó|pay/.test(h)) return call("approve_payment");
  if (/^no\b/.test(h)) return call("refuse_payment");
  return { parts: [{ text: "Take your time. Say pay or no when you are ready." }], usage };
}

async function speak(sentences: string[], lang: Lang, t: Turn) {
  t.spoken.push(...sentences);
  const start = Date.now();
  for (const text of sentences) {
    if (!text) continue;
    const key = createHash("sha1").update([TTS_MODEL, VOICE, lang, text].join("|")).digest("hex");
    const file = join(CACHE_DIR, `${key}.mp3`);
    if (USE_CACHE && (existsSync(file) || (DRY && dryCache.has(key)))) {
      t.ttsCachedChars += text.length;
    } else {
      t.ttsBilledChars += text.length;
      if (!DRY) writeFileSync(file, Buffer.from(await tts(text, lang, VOICE, "mp3_44100_128")));
      else dryCache.add(key);
    }
    if (!t.ms.firstAudio) t.ms.firstAudio = Date.now() - start;
  }
  t.ms.tts = Date.now() - start;
}

async function tts(text: string, lang: Lang, voice: string, format: string): Promise<ArrayBuffer> {
  const call = (code?: string) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${format}`, {
      method: "POST",
      headers: { "xi-api-key": XI, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: TTS_MODEL, ...(code ? { language_code: code } : {}) }),
    });
  let res = await call(ELEVEN_LANG[lang]);
  if (res.status === 400 || res.status === 422) res = await call(undefined);
  if (!res.ok) throw new Error(`elevenlabs tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

async function transcribe(wav: Buffer, lang: Lang): Promise<string> {
  const form = new FormData();
  form.append("model_id", STT_MODEL);
  form.append("file", new Blob([wav]), "answer.wav");
  form.append("tag_audio_events", "false");
  if (STT_LANG[lang]) form.append("language_code", STT_LANG[lang]!);
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": XI }, body: form });
  if (!res.ok) throw new Error(`elevenlabs stt ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { text?: string }).text ?? "";
}

/** The customer's voice for a turn: your own recording if present, otherwise generated once. */
async function userAudio(s: Scenario, i: number): Promise<Buffer> {
  const file = join(AUDIO_DIR, `${s.id}-${i + 1}.wav`);
  if (existsSync(file)) return readFileSync(file);
  const text = s.turns[i];
  if (DRY) return wavFromPcm(Buffer.alloc(Math.round(16000 * 2 * Math.max(1, text.split(/\s+/).length * 0.4)))); // ~0.4 s a word
  setup.userAudioChars += text.length;
  const pcm = Buffer.from(await tts(text, s.lang, USER_VOICE, "pcm_16000"));
  const wav = wavFromPcm(pcm);
  writeFileSync(file, wav);
  return wav;
}

function wavFromPcm(pcm: Buffer): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Length of a PCM WAV in seconds, read from its header. */
function wavSeconds(wav: Buffer): number {
  if (wav.toString("ascii", 0, 4) !== "RIFF") return 0;
  const byteRate = wav.readUInt32LE(28);
  let off = 12;
  while (off + 8 <= wav.length) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    if (id === "data") return byteRate ? Math.min(size, wav.length - off - 8) / byteRate : 0;
    off += 8 + size;
  }
  return 0;
}

/** ElevenLabs' own counter of credits used this billing period. */
async function creditsUsed(): Promise<number> {
  const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": XI } });
  if (!res.ok) throw new Error(`elevenlabs subscription ${res.status}`);
  return ((await res.json()) as { character_count: number }).character_count;
}

function blankTurn(s: Scenario, turn: number, said: string): Turn {
  return { scenario: s.id, turn, said, heard: said, path: "fast", tools: [], sttSeconds: 0, ttsBilledChars: 0, ttsCachedChars: 0, llm: { input: 0, cached: 0, output: 0, calls: 0 }, ms: { stt: 0, llm: 0, tts: 0, firstAudio: 0 }, usd: { stt: 0, llm: 0, tts: 0, total: 0 }, spoken: [] };
}

function finish(t: Turn) {
  t.usd.stt = t.turn === 0 ? 0 : sttUsd(t.sttSeconds);
  t.usd.llm = llmUsd(t.llm);
  t.usd.tts = ttsUsd(TTS_MODEL, t.ttsBilledChars);
  t.usd.total = t.usd.stt + t.usd.llm + t.usd.tts;
  rows.push(t);
  const n = (u: number) => `₦${(u * PRICES.ngnPerUsd).toFixed(2)}`;
  console.log(`${t.scenario} #${t.turn} [${t.path}] ${n(t.usd.total)}  heard="${t.heard.slice(0, 60)}"  tools=${t.tools.join(",") || "-"}`);
}

function report(scenarios: Scenario[], before: number | null, after: number | null, ms: number) {
  const ngn = (u: number) => u * PRICES.ngnPerUsd;
  const f = (x: number) => `₦${x.toFixed(2)}`;
  const sum = (fn: (t: Turn) => number, list = rows) => list.reduce((a, t) => a + fn(t), 0);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const csvHead = "scenario,turn,path,tools,said,heard,stt_seconds,tts_billed_chars,tts_cached_chars,llm_calls,llm_input,llm_cached,llm_output,ms_stt,ms_llm,ms_first_audio,usd_stt,usd_llm,usd_tts,usd_total,ngn_total";
  const csv = rows.map((t) =>
    [t.scenario, t.turn, t.path, t.tools.join("|"), JSON.stringify(t.said), JSON.stringify(t.heard), t.sttSeconds.toFixed(2), t.ttsBilledChars, t.ttsCachedChars, t.llm.calls, t.llm.input, t.llm.cached, t.llm.output, t.ms.stt, t.ms.llm, t.ms.firstAudio, t.usd.stt.toFixed(6), t.usd.llm.toFixed(6), t.usd.tts.toFixed(6), t.usd.total.toFixed(6), ngn(t.usd.total).toFixed(2)].join(","),
  );
  writeFileSync(join(OUT_DIR, `${stamp}.csv`), [csvHead, ...csv].join("\n"));

  const userTurns = rows.filter((t) => t.turn > 0);
  const aiTurns = userTurns.filter((t) => t.path === "ai");
  const fastTurns = userTurns.filter((t) => t.path === "fast");
  const lines: string[] = [];
  lines.push(`# Voice cost experiment ${DRY ? "(DRY RUN: no APIs called, AI tokens are rough guesses)" : ""}`, "");
  lines.push(`Run ${new Date().toISOString()}, ${scenarios.length} conversations, ${userTurns.length} customer turns, ${Math.round(ms / 1000)} s.`);
  lines.push(`Voice model ${TTS_MODEL}, listening model ${STT_MODEL}, AI model ${GEMINI_MODEL}, saved-audio cache ${USE_CACHE ? "on" : "off"}, ₦${PRICES.ngnPerUsd}/$.`, "");
  lines.push("## Per conversation", "", "| Conversation | Turns (AI / shortcut) | Tools and answers | Hear | AI model | Speak | Total |", "|---|---|---|---|---|---|---|");
  for (const s of scenarios) {
    const rs = rows.filter((t) => t.scenario === s.id);
    const done = rs.flatMap((t) => t.tools);
    const ok = s.expect.every((e) => done.includes(e)) ? "" : " ⚠ expected " + s.expect.join("+");
    lines.push(`| ${s.id} | ${rs.filter((t) => t.path === "ai" && t.turn > 0).length} / ${rs.filter((t) => t.path === "fast" && t.turn > 0).length} | ${done.join(", ") || "-"}${ok} | ${f(ngn(sum((t) => t.usd.stt, rs)))} | ${f(ngn(sum((t) => t.usd.llm, rs)))} | ${f(ngn(sum((t) => t.usd.tts, rs)))} | **${f(ngn(sum((t) => t.usd.total, rs)))}** |`);
  }
  const total = sum((t) => t.usd.total);
  lines.push("", "## Averages", "");
  lines.push(`- Per conversation: **${f(ngn(total / scenarios.length))}** (live agent on 21 Nov: ${f(ngn(AGENT_BASELINE.usdPerPaymentConversation))} for one payment).`);
  if (aiTurns.length) lines.push(`- Per AI turn: ${f(ngn(sum((t) => t.usd.total, aiTurns) / aiTurns.length))} (AI model alone ${f(ngn(sum((t) => t.usd.llm, aiTurns) / aiTurns.length))}; ${Math.round(sum((t) => t.llm.input, aiTurns) / aiTurns.length)} input tokens).`);
  if (fastTurns.length) lines.push(`- Per shortcut turn (no AI): ${f(ngn(sum((t) => t.usd.total, fastTurns) / fastTurns.length))}.`);
  lines.push(`- Speech heard: ${sum((t) => t.sttSeconds, userTurns).toFixed(1)} s. Speech spoken: ${sum((t) => t.ttsBilledChars)} characters billed, ${sum((t) => t.ttsCachedChars)} served from saved audio.`);
  const avg = (fn: (t: Turn) => number, list: Turn[]) => (list.length ? Math.round(list.reduce((a, t) => a + fn(t), 0) / list.length) : 0);
  lines.push(`- Waiting time per AI turn: hearing ${avg((t) => t.ms.stt, aiTurns)} ms + AI ${avg((t) => t.ms.llm, aiTurns)} ms + first audio ${avg((t) => t.ms.firstAudio, aiTurns)} ms (no streaming yet; streaming would start speaking sooner).`);
  if (before !== null && after !== null) {
    const used = after - before;
    lines.push("", "## Checked against ElevenLabs' own counter", "");
    lines.push(`- Credits used during the measured run: **${used}** (≈ ${f(ngn(used * PRICES.usdPerCredit))} at $6 per 30,000 credits).`);
    lines.push(`- Characters this script counted as billed: ${sum((t) => t.ttsBilledChars)}. If credits ≈ characters, the speak line above is right. Listening may also use credits; the difference shows how much.`);
    lines.push("- The AI model line is billed by Google, not ElevenLabs: check the usage page in Google AI Studio.");
  }
  if (setup.userAudioChars) lines.push("", `Setup (not counted above): ${setup.userAudioChars} characters to generate the customer's voice for turns without your own recording.`);
  lines.push("", "## Monthly estimate per user", "");
  const perConv = total / scenarios.length;
  for (const n of [20, 40]) lines.push(`- ${n} conversations a month at this mix: ${f(ngn(perConv * n))} (live agent at ${f(ngn(AGENT_BASELINE.usdPerPaymentConversation))} each: ${f(ngn(AGENT_BASELINE.usdPerPaymentConversation * n))}).`);
  lines.push("", `Rows: results/${stamp}.csv`);
  const md = lines.join("\n");
  writeFileSync(join(OUT_DIR, `${stamp}.md`), md);
  console.log("\n" + md);
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
