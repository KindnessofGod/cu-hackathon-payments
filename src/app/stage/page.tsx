"use client";
// The studio screen for a live demo on a big stage. It shows the customer's Pay Alone and the payee
// side by side, drawn here from live events the customer's device sends (no screen video), and plays
// the Pay Alone voice: the same audio the device receives from the voice service, forwarded.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GlassOrb } from "@/components/GlassOrb";
import { formatAmount, nairaOf, type Amount } from "@/lib/money";
import { stageListen, type StageEvent } from "@/lib/stage";

type Brief = { id: string; merchantName: string; outgoing: boolean; status: string; amount: Amount; receive: Amount | null } | null;
type Snap = {
  name: string;
  left: Amount | null;
  limit: Amount | null;
  every: "day" | "week" | null;
  pending: Brief;
  last: Brief;
  lines: { who: "app" | "you"; text: string }[];
};
type Mode = "" | "connecting" | "listening" | "speaking";

/** Plays the forwarded voice: chunks of 16-bit PCM (or μ-law), queued back to back. */
class Player {
  ctx: AudioContext;
  analyser: AnalyserNode;
  next = 0;
  sources: AudioBufferSourceNode[] = [];
  data = new Uint8Array(256);
  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(this.ctx.destination);
  }
  play(b64: string, fmt: string) {
    const bin = atob(b64);
    const [kind, rateText] = fmt.split("_");
    const rate = Number(rateText) || 16000;
    let samples: Float32Array;
    if (kind === "ulaw") {
      samples = new Float32Array(bin.length);
      for (let i = 0; i < bin.length; i++) samples[i] = ulaw(bin.charCodeAt(i));
    } else {
      samples = new Float32Array(bin.length >> 1);
      for (let i = 0; i < samples.length; i++) {
        let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
        if (v >= 0x8000) v -= 0x10000;
        samples[i] = v / 32768;
      }
    }
    if (!samples.length) return;
    const buf = this.ctx.createBuffer(1, samples.length, rate);
    buf.getChannelData(0).set(samples);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);
    const now = this.ctx.currentTime;
    if (this.next < now + 0.03) this.next = now + 0.12; // a small cushion when a new sentence starts
    src.start(this.next);
    this.next += buf.duration;
    this.sources.push(src);
    src.onended = () => (this.sources = this.sources.filter((s) => s !== src));
  }
  flush() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already ended
      }
    }
    this.sources = [];
    this.next = 0;
  }
  level(): number {
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (const v of this.data) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / this.data.length);
  }
}

/** Two seconds of a soft three-note tone as 16 kHz PCM, base64: the studio's sound check. */
function tone(): string {
  const rate = 16000;
  const n = rate * 2;
  let bin = "";
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const hz = t < 0.6 ? 523 : t < 1.2 ? 659 : 784;
    const env = Math.min(1, (t % 0.6) * 20) * Math.max(0, 1 - (t % 0.6) / 0.6);
    const v = Math.round(Math.sin(2 * Math.PI * hz * t) * env * 0.5 * 32767) & 0xffff;
    bin += String.fromCharCode(v & 0xff, v >> 8);
  }
  return btoa(bin);
}

function ulaw(u: number): number {
  u = ~u & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let s = ((mantissa << 3) + 0x84) << exponent;
  s -= 0x84;
  return (sign ? -s : s) / 32768;
}

const STATUS: Record<string, { text: string; tone: "wait" | "go" | "good" | "bad" }> = {
  waiting: { text: "Waiting for the customer", tone: "wait" },
  quoted: { text: "Waiting for the customer", tone: "wait" },
  consent: { text: "Wallet is confirming", tone: "go" },
  paying: { text: "Paying…", tone: "go" },
  paid: { text: "Paid", tone: "good" },
  declined: { text: "Refused. No money moved.", tone: "bad" },
  expired: { text: "Timed out. No money moved.", tone: "bad" },
  failed: { text: "Failed. No money moved.", tone: "bad" },
};

function money(a: Amount | null | undefined): string {
  if (!a) return "";
  const n = nairaOf(a);
  return `${formatAmount(a)}${n ? `  (≈ ₦${n})` : ""}`;
}

/** The app's own layout narrows pages; the studio screen covers the whole window instead. */
export default function StagePage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(<Stage />, document.body) : null;
}

function Stage() {
  const [key, setKey] = useState("");
  const [started, setStarted] = useState(false);
  const [link, setLink] = useState("connecting");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [mode, setMode] = useState<Mode>("");
  const [prompt, setPrompt] = useState<{ id: string; text: string } | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [now, setNow] = useState(0);
  const player = useRef<Player | null>(null);
  const micLevel = useRef(0);
  const modeRef = useRef<Mode>("");

  useEffect(() => {
    setKey(new URLSearchParams(window.location.search).get("k") ?? "");
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Test pattern (/stage?k=test): a made-up run, clearly labelled, so the studio can check screen and sound.
  useEffect(() => {
    if (key !== "test" || !started) return;
    const usd = (v: string): Amount => ({ value: v, assetCode: "USD", assetScale: 2 });
    const req = (status: string): Brief => ({ id: "test", merchantName: "Mama Chris", outgoing: false, status, amount: usd("100"), receive: usd("100") });
    const lines: Snap["lines"] = [];
    const base = { name: "Gloria", left: usd("2900"), limit: usd("3000"), every: "week" as const, last: null };
    const steps: [number, () => void][] = [
      [0, () => setSnap({ ...base, pending: req("quoted"), lines: [] })],
      [600, () => setMode("speaking")],
      [700, () => player.current?.play(tone(), "pcm_16000")],
      [800, () => setSnap({ ...base, pending: req("quoted"), lines: (lines.push({ who: "app", text: "Mama Chris is asking you for 1 dollar, about 1,354 naira. Do you want to pay?" }), [...lines]) })],
      [3200, () => setMode("listening")],
      [4500, () => setSnap({ ...base, pending: req("quoted"), lines: (lines.push({ who: "you", text: "Yes, pay her." }), [...lines]) })],
      [5200, () => setPrompt({ id: "test", text: "To pay, rest your finger on the Home button. To refuse, do nothing." })],
      [7500, () => setSnap({ ...base, pending: req("paying"), lines: [...lines] })],
      [8600, () => setSnap({ ...base, left: usd("2800"), pending: null, last: req("paid"), lines: [...lines] })],
    ];
    setLastSeen(Date.now());
    const timers = steps.map(([ms, f]) => setTimeout(f, ms));
    const keep = setInterval(() => setLastSeen(Date.now()), 1000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(keep);
    };
  }, [key, started]);

  useEffect(() => {
    if (!key || !started || key === "test") return;
    return stageListen(
      key,
      (e: StageEvent, p) => {
        setLastSeen(Date.now());
        if (e === "audio") player.current?.play(String(p.b64 ?? ""), String(p.fmt ?? "pcm_16000"));
        else if (e === "flush") player.current?.flush();
        else if (e === "level") micLevel.current = Number(p.v) || 0;
        else if (e === "mode") {
          modeRef.current = (p.mode as Mode) ?? "";
          setMode(modeRef.current);
        } else if (e === "prompt") setPrompt({ id: String(p.id ?? ""), text: String(p.text ?? "") });
        else if (e === "snap") {
          const s = p as unknown as Snap & { mode?: Mode };
          setSnap(s);
          if (s.mode !== undefined && s.mode !== modeRef.current) {
            modeRef.current = s.mode;
            setMode(s.mode);
          }
        }
      },
      setLink,
    );
  }, [key, started]);

  if (!key)
    return (
      <main className="stg-center">
        <h1>Studio link is missing its key</h1>
        <p>Open the full link shown on the customer&apos;s Pay Alone in stage mode: /stage?k=…</p>
        <style>{css}</style>
      </main>
    );

  if (!started)
    return (
      <button
        className="stg-start"
        onClick={() => {
          player.current = new Player();
          void player.current.ctx.resume();
          setStarted(true);
          void document.documentElement.requestFullscreen?.().catch(() => {});
        }}
      >
        <span className="stg-start-title">Pay Alone · studio feed</span>
        <span>Click to start (this turns the sound on and goes full screen)</span>
        <style>{css}</style>
      </button>
    );

  const live = lastSeen > 0 && now - lastSeen < 6000;
  const req = snap?.pending ?? snap?.last ?? null;
  const st = req ? (STATUS[req.status] ?? { text: req.status, tone: "wait" as const }) : null;
  const fingerAsked = Boolean(req && snap?.pending && prompt?.id === req.id && /finger|Home button/i.test(prompt.text));
  const showPrompt = req && snap?.pending && prompt?.id === req.id ? prompt.text : "";
  const name = snap?.name ?? "Customer";
  const level = () => Math.min(1, (modeRef.current === "speaking" ? (player.current?.level() ?? 0) * 4 : modeRef.current === "listening" ? micLevel.current * 2.2 : 0));

  return (
    <main className="stg">
      <header className="stg-top">
        <span className="stg-brand">Pay Alone</span>
        <span className={`stg-live ${live ? "on" : ""}`}>{key === "test" ? "TEST PATTERN · not live · made-up payment" : live ? "● LIVE from the iPad" : link === "SUBSCRIBED" ? "Waiting for the iPad…" : `Connecting (${link})…`}</span>
      </header>
      <section className="stg-grid">
        <div className="stg-pane">
          <div className="stg-who">
            <b>{name}</b>
            <span>Blind customer · her Pay Alone on iPad</span>
          </div>
          <div className="stg-orb">
            <GlassOrb mode={mode || "idle"} level={mode ? level : undefined} size="min(22rem, 34vh)" />
            <div className="stg-mode">{mode === "speaking" ? "Pay Alone is speaking" : mode === "listening" ? `Listening to ${name}` : mode === "connecting" ? "Connecting the voice…" : "Ready"}</div>
          </div>
          <ol className="stg-lines">
            {(snap?.lines ?? []).slice(-4).map((l, i) => (
              <li key={i} className={l.who}>
                <small>{l.who === "you" ? name : "Pay Alone"}</small>
                {l.text}
              </li>
            ))}
          </ol>
          {snap?.left && (
            <div className="stg-cap">
              Left to spend this {snap.every ?? "week"}: <b>{money(snap.left)}</b>
              {snap.limit ? <span> of {formatAmount(snap.limit)}</span> : null}
            </div>
          )}
        </div>
        <div className="stg-pane right">
          <div className="stg-who">
            <b>{req?.merchantName ?? "Mama Chris"}</b>
            <span>{req?.outgoing ? "Receiving from Pay Alone" : "Seller · asks for payment"}</span>
          </div>
          {req ? (
            <div className={`stg-req ${st?.tone}`}>
              <div className="stg-req-what">{req.outgoing ? `${name} sends` : `Asked ${name} for`}</div>
              <div className="stg-req-amt">{formatAmount(req.amount)}</div>
              {nairaOf(req.amount) && <div className="stg-req-ngn">≈ ₦{nairaOf(req.amount)}</div>}
              <div className="stg-req-status">
                {req.status === "paid" ? "✓ " : ""}
                {fingerAsked && req.status !== "paid" ? "Fingerprint requested on the iPad" : st?.text}
              </div>
              {req.status === "paid" && req.receive && <div className="stg-req-sub">{money(req.receive)} received over Interledger</div>}
              {showPrompt && req.status !== "paid" && <div className="stg-req-sub">On the iPad: “{showPrompt}”</div>}
            </div>
          ) : (
            <div className="stg-req wait">
              <div className="stg-req-what">No payment yet</div>
              <div className="stg-req-sub">A request appears here the moment it is sent.</div>
            </div>
          )}
        </div>
      </section>
      <footer className="stg-foot">Interledger Open Payments · test network · money moves in US dollars; naira shown at the CBN rate of 16 Nov (₦1,353.97 per $1)</footer>
      <style>{css}</style>
    </main>
  );
}

const css = `
body { margin: 0; background: #071a15; }
.stg, .stg-center, .stg-start { min-height: 100vh; background: radial-gradient(circle at 25% 20%, #0f3b31, #071a15 60%); color: #eafff7; font-family: var(--font-sans, system-ui), sans-serif; }
.stg-center { display: grid; place-content: center; text-align: center; padding: 2rem; }
.stg-start { width: 100%; border: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; font-size: 1.4rem; cursor: pointer; }
.stg-start-title { font-size: 3rem; font-weight: 800; color: #d9f7a0; }
.stg { position: fixed; inset: 0; z-index: 1000; max-width: none; margin: 0; width: auto; display: flex; flex-direction: column; padding: 1.5rem 2.5rem; box-sizing: border-box; overflow: hidden; }
.stg-start, .stg-center { position: fixed; inset: 0; z-index: 1000; max-width: none; margin: 0; }
.stg-top { display: flex; justify-content: space-between; align-items: center; }
.stg-brand { font-weight: 800; font-size: 1.8rem; color: #d9f7a0; }
.stg-live { font-weight: 700; font-size: 1.1rem; color: #9fb8af; }
.stg-live.on { color: #ff5a5a; }
.stg-grid { flex: 1; display: grid; grid-template-columns: 1.25fr 1fr; gap: 2rem; margin-top: 1rem; min-height: 0; }
.stg-pane { background: #0d2c25cc; border: 1px solid #2a5a4d; border-radius: 28px; padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1rem; min-height: 0; }
.stg-pane.right { justify-content: flex-start; background: #f4fbf3; color: #0b2a22; border-color: #cfe7d8; }
.stg-who b { display: block; font-size: 2.1rem; }
.stg-who span { opacity: .75; font-size: 1.1rem; }
.stg-orb { display: flex; flex-direction: column; align-items: center; gap: .5rem; }
.stg-mode { font-size: 1.3rem; font-weight: 700; color: #8ef0d2; }
.stg-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; overflow: hidden; flex: 1; justify-content: flex-end; }
.stg-lines li { padding: .6rem 1rem; border-radius: 18px; font-size: 1.35rem; line-height: 1.35; max-width: 92%; }
.stg-lines li small { display: block; font-size: .8rem; opacity: .7; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.stg-lines li.app { background: #134a3d; align-self: flex-start; }
.stg-lines li.you { background: #d9f7a0; color: #0b2a22; align-self: flex-end; }
.stg-cap { font-size: 1.2rem; opacity: .9; }
.stg-req { border-radius: 24px; padding: 2rem; background: #fff; border: 3px solid #cfe7d8; display: flex; flex-direction: column; gap: .5rem; }
.stg-req.go { border-color: #2a8fe0; }
.stg-req.good { border-color: #11a88f; background: #e6fff6; }
.stg-req.bad { border-color: #e05a4a; background: #fff1ef; }
.stg-req-what { font-size: 1.3rem; opacity: .75; }
.stg-req-amt { font-size: clamp(2.5rem, 5vw, 5rem); font-weight: 800; line-height: 1; white-space: nowrap; }
.stg-req-ngn { font-size: 1.8rem; font-weight: 700; color: #0b6b55; }
.stg-req-status { font-size: 2rem; font-weight: 800; margin-top: 1rem; }
.stg-req.good .stg-req-status { color: #0b8a6f; font-size: 3rem; }
.stg-req-sub { font-size: 1.15rem; opacity: .8; }
.stg-foot { font-size: .95rem; opacity: .6; margin-top: 1rem; }
@media (max-width: 900px) { .stg { overflow: auto; } .stg-grid { grid-template-columns: 1fr; } }
`;
