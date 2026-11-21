"use client";
// The studio screen for a live demo on a big stage. Left two thirds: a live copy of the customer's
// Pay Alone screen, drawn with the app's own styles from the HTML the iPad sends (no screen video). Right
// third: the seller's side. On top: a copy of the iPad's fingerprint sheet, since iOS draws that one itself.
// It also plays the Pay Alone voice: the same audio the iPad receives from the voice service, forwarded.
// Locked with the merchant key: the channel's name is a secret from /api/stage.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import morphdom from "morphdom";
import { GlassOrb, type OrbMode } from "@/components/GlassOrb";
import { MerchantKey } from "@/components/MerchantKey";
import { formatAmount, nairaOf, type Amount } from "@/lib/money";
import { stageChannelName, stageListen, type StageEvent } from "@/lib/stage";

type Brief = {
  id: string;
  merchantName: string;
  outgoing: boolean;
  status: string;
  amount: Amount;
  receive: Amount | null;
} | null;
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
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
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
  /** The same happy "paid" sound as on the iPad. */
  ding() {
    const t0 = this.ctx.currentTime + 0.02;
    const notes: [number, number, number][] = [
      [784, 0, 0.35],
      [988, 0.11, 0.35],
      [1175, 0.22, 0.4],
      [1568, 0.36, 0.9],
      [2349, 0.36, 0.7],
    ];
    for (const [hz, at, len] of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = hz;
      const peak = hz > 2000 ? 0.25 : 0.6;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(gain).connect(this.analyser);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.05);
    }
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
    const v =
      Math.round(Math.sin(2 * Math.PI * hz * t) * env * 0.5 * 32767) & 0xffff;
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

const STATUS: Record<
  string,
  { text: string; tone: "wait" | "go" | "good" | "bad" }
> = {
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

type HeadInfo = {
  css: string[];
  styles: string;
  htmlClass: string;
  htmlStyle: string;
  bodyClass: string;
  lang: string;
};
type Finger = {
  state: "ask" | "ok" | "fail";
  merchant: string;
  amount: Amount | null;
  at: number;
} | null;

async function gunzip(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/**
 * The live copy of the iPad screen: a sandboxed frame (no scripts can run in it) holding the iPad's HTML
 * and the app's own stylesheets. Updates are merged in place, so the app's animations keep running.
 */
class Screen {
  w = 1180;
  h = 820;
  loaded = false;
  private head = "";
  private queue: (() => void)[] = [];
  private order = 0;
  constructor(
    private frame: HTMLIFrameElement,
    private onSize: () => void,
  ) {
    const ready = () => {
      this.loaded = true;
      const q = this.queue;
      this.queue = [];
      q.forEach((f) => f());
    };
    if (
      frame.contentDocument?.readyState === "complete" &&
      frame.contentDocument.body
    )
      ready();
    else frame.addEventListener("load", ready, { once: true });
  }
  get doc(): Document | null {
    return this.frame.contentDocument;
  }
  private when(f: () => void) {
    if (this.loaded) f();
    else this.queue.push(f);
  }
  setHead(h: HeadInfo) {
    const key = JSON.stringify(h);
    if (key === this.head) return;
    this.head = key;
    this.when(() => {
      const d = this.doc;
      if (!d) return;
      d.head.querySelectorAll("[data-m]").forEach((n) => n.remove());
      const base = d.createElement("base");
      base.href = window.location.origin + "/";
      base.setAttribute("data-m", "");
      d.head.appendChild(base);
      for (const href of h.css) {
        const u = new URL(href, window.location.origin);
        if (u.origin !== window.location.origin) continue; // only this site's own stylesheets
        const l = d.createElement("link");
        l.rel = "stylesheet";
        l.href = u.pathname + u.search;
        l.setAttribute("data-m", "");
        d.head.appendChild(l);
      }
      const st = d.createElement("style");
      st.setAttribute("data-m", "");
      st.textContent = `${h.styles}\nhtml,body{scrollbar-width:none}::-webkit-scrollbar{display:none}img[src*="/api/"]{visibility:hidden}`;
      d.head.appendChild(st);
      d.documentElement.className = h.htmlClass;
      if (h.htmlStyle) d.documentElement.setAttribute("style", h.htmlStyle);
      d.documentElement.lang = h.lang || "en";
      d.body.className = h.bodyClass;
    });
  }
  async setDom(p: { z: string; w: number; h: number; sy: number; sx: number }) {
    const n = ++this.order;
    const html = await gunzip(p.z);
    if (n !== this.order) return; // a newer copy already arrived
    this.when(() => {
      const d = this.doc;
      if (!d) return;
      if (p.w && p.h && (p.w !== this.w || p.h !== this.h)) {
        this.w = p.w;
        this.h = p.h;
        this.onSize();
      }
      const next = d.createElement("body");
      next.innerHTML = html;
      morphdom(d.body, next, {
        childrenOnly: true,
        onBeforeElUpdated: (from, to) => !from.isEqualNode(to),
      });
      this.scroll(p);
    });
  }
  scroll(p: { sy: number; sx: number }) {
    this.when(() => {
      const d = this.doc;
      if (!d) return;
      d.querySelectorAll<HTMLElement>("[data-mscroll]").forEach((el) => {
        const [t, l] = (el.getAttribute("data-mscroll") ?? "0,0")
          .split(",")
          .map(Number);
        el.scrollTop = t || 0;
        el.scrollLeft = l || 0;
      });
      d.defaultView?.scrollTo(p.sx || 0, p.sy || 0);
    });
  }
}

/** The app's own layout narrows pages; the studio screen covers the whole window instead. */
export default function StagePage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(<Stage />, document.body) : null;
}

function Stage() {
  const [test, setTest] = useState<boolean | null>(null);
  const [channel, setChannel] = useState("");
  const [locked, setLocked] = useState(false);
  const [chanError, setChanError] = useState("");
  const [started, setStarted] = useState(false);
  const [link, setLink] = useState("connecting");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [mode, setMode] = useState<Mode>("");
  const [prompt, setPrompt] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [finger, setFinger] = useState<Finger>(null);
  const [hasScreen, setHasScreen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const [now, setNow] = useState(0);
  const [fit, setFit] = useState({ scale: 0.5, w: 1180, h: 820 });
  const [mfit, setMfit] = useState({ scale: 0.5, w: 390, h: 844 });
  const [hasMerchant, setHasMerchant] = useState(false);
  const mscreen = useRef<Screen | null>(null);
  const mframeRef = useRef<HTMLIFrameElement>(null);
  const marea = useRef<HTMLDivElement>(null);
  const [orb, setOrb] = useState<{ mode: OrbMode } | null>(null);
  const player = useRef<Player | null>(null);
  const micLevel = useRef(0);
  const modeRef = useRef<Mode>("");
  const screen = useRef<Screen | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const orbBox = useRef<HTMLDivElement>(null);
  const fitRef = useRef(fit);
  const lastAsk = useRef<{ merchant: string; amount: Amount | null }>({
    merchant: "",
    amount: null,
  });
  const fingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findChannel = useCallback(() => {
    setChanError("");
    void stageChannelName().then((n) => {
      if ("channel" in n) {
        setLocked(false);
        setChannel(n.channel);
      } else if (n.locked) setLocked(true);
      else setChanError(n.error);
    });
  }, []);

  useEffect(() => {
    const t0 = new URLSearchParams(window.location.search).get("k") === "test";
    setTest(t0);
    if (!t0) findChannel();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [findChannel]);

  // Fit the iPad's screen into the left two thirds, keeping its exact proportions.
  const refit = useCallback(() => {
    const box = area.current;
    const s = screen.current;
    if (!box) return;
    const w = s?.w ?? 1180;
    const h = s?.h ?? 820;
    const pad = 28; // the iPad's bezel
    const scale = Math.min(
      (box.clientWidth - pad * 2) / w,
      (box.clientHeight - pad * 2) / h,
    );
    fitRef.current = { scale: Math.max(0.1, scale), w, h };
    setFit(fitRef.current);
  }, []);
  useEffect(() => {
    if (!started || !area.current) return;
    const ro = new ResizeObserver(refit);
    ro.observe(area.current);
    refit();
    return () => ro.disconnect();
  }, [started, refit]);

  useEffect(() => {
    if (!started || !frameRef.current) return;
    screen.current = new Screen(frameRef.current, refit);
  }, [started, refit]);

  // The seller's phone on the right: same idea, a phone-shaped frame.
  const refitM = useCallback(() => {
    const box = marea.current;
    if (!box) return;
    const w = mscreen.current?.w ?? 390;
    const h = mscreen.current?.h ?? 844;
    const pad = 12;
    const scale = Math.min((box.clientWidth - pad * 2) / w, (box.clientHeight - pad * 2) / h);
    setMfit({ scale: Math.max(0.1, scale), w, h });
  }, []);
  useEffect(() => {
    if (!started || !marea.current || !mframeRef.current) return;
    mscreen.current = new Screen(mframeRef.current, refitM);
    mscreen.current.w = 390;
    mscreen.current.h = 844;
    const ro = new ResizeObserver(refitM);
    ro.observe(marea.current);
    refitM();
    return () => ro.disconnect();
  }, [started, refitM]);

  // The 3D orb is a canvas, which the HTML copy cannot carry: draw ours exactly where the iPad has its own.
  useEffect(() => {
    if (!started) return;
    let raf = 0;
    let lastMode = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const d = screen.current?.doc;
      const el = d?.querySelector<HTMLElement>(".glass-orb");
      const box = orbBox.current;
      const frame = frameRef.current;
      if (!el || !box || !frame) {
        if (lastMode) {
          lastMode = "";
          setOrb(null);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 4) return;
      const sc = fitRef.current.scale;
      box.style.left = `${r.left * sc}px`;
      box.style.top = `${r.top * sc}px`;
      box.style.width = `${r.width * sc}px`;
      box.style.height = `${r.height * sc}px`;
      const m =
        (["speaking", "listening", "connecting"] as OrbMode[]).find((x) =>
          el.classList.contains(x),
        ) ?? "idle";
      if (m !== lastMode) {
        lastMode = m;
        setOrb({ mode: m });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  const showFinger = useCallback((f: Finger) => {
    if (fingerTimer.current) clearTimeout(fingerTimer.current);
    setFinger(f);
    if (f?.state === "ok")
      fingerTimer.current = setTimeout(() => setFinger(null), 2200);
    if (f?.state === "fail")
      fingerTimer.current = setTimeout(() => setFinger(null), 3500);
  }, []);

  // Test pattern (/stage?k=test): a made-up run, clearly labelled, so the studio can check screen and sound.
  useEffect(() => {
    if (!test || !started) return;
    const usd = (v: string): Amount => ({
      value: v,
      assetCode: "USD",
      assetScale: 2,
    });
    const req = (status: string): Brief => ({
      id: "test",
      merchantName: "Mama Chris",
      outgoing: false,
      status,
      amount: usd("100"),
      receive: usd("100"),
    });
    const base = {
      name: "Gloria",
      left: usd("2900"),
      limit: usd("3000"),
      every: "week" as const,
      last: null,
      lines: [],
    };
    const steps: [number, () => void][] = [
      [0, () => setSnap({ ...base, pending: req("quoted") })],
      [500, () => player.current?.play(tone(), "pcm_16000")],
      [
        2500,
        () =>
          showFinger({
            state: "ask",
            merchant: "Mama Chris",
            amount: usd("100"),
            at: Date.now(),
          }),
      ],
      [
        5000,
        () =>
          showFinger({
            state: "fail",
            merchant: "Mama Chris",
            amount: usd("100"),
            at: Date.now(),
          }),
      ],
      [
        8500,
        () =>
          showFinger({
            state: "ask",
            merchant: "Mama Chris",
            amount: usd("100"),
            at: Date.now(),
          }),
      ],
      [
        11000,
        () => (
          showFinger({
            state: "ok",
            merchant: "Mama Chris",
            amount: usd("100"),
            at: Date.now(),
          }),
          setSnap({ ...base, pending: req("paying") })
        ),
      ],
      [
        12500,
        () => (
          setSnap({
            ...base,
            left: usd("2800"),
            pending: null,
            last: req("paid"),
          }),
          player.current?.ding()
        ),
      ],
    ];
    setLastSeen(Date.now());
    const timers = steps.map(([ms, f]) => setTimeout(f, ms));
    const keep = setInterval(() => setLastSeen(Date.now()), 1000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(keep);
    };
  }, [test, started, showFinger]);

  const onEvent = useCallback(
    (e: StageEvent, p: Record<string, unknown>) => {
      setLastSeen(Date.now());
      if (e === "audio")
        player.current?.play(String(p.b64 ?? ""), String(p.fmt ?? "pcm_16000"));
      else if (e === "flush") player.current?.flush();
      else if (e === "ding") player.current?.ding();
      else if (e === "level") micLevel.current = Number(p.v) || 0;
      else if (e === "head") screen.current?.setHead(p as unknown as HeadInfo);
      else if (e === "mhead") mscreen.current?.setHead(p as unknown as HeadInfo);
      else if (e === "mdom") {
        setHasMerchant(true);
        void mscreen.current?.setDom(p as unknown as { z: string; w: number; h: number; sy: number; sx: number }).catch(() => {});
      } else if (e === "mscroll") mscreen.current?.scroll(p as unknown as { sy: number; sx: number });
      else if (e === "dom") {
        setHasScreen(true);
        void screen.current
          ?.setDom(
            p as unknown as {
              z: string;
              w: number;
              h: number;
              sy: number;
              sx: number;
            },
          )
          .catch(() => {});
      } else if (e === "scroll")
        screen.current?.scroll(p as unknown as { sy: number; sx: number });
      else if (e === "finger") {
        const st = String(p.state ?? "");
        if (st === "closed") showFinger(null);
        else if (st === "ask" || st === "ok" || st === "fail") {
          if (st === "ask")
            lastAsk.current = {
              merchant: String(p.merchant ?? ""),
              amount: (p.amount as Amount) ?? null,
            };
          showFinger({ state: st, ...lastAsk.current, at: Date.now() });
        }
      } else if (e === "mode") {
        modeRef.current = (p.mode as Mode) ?? "";
        setMode(modeRef.current);
      } else if (e === "prompt")
        setPrompt({ id: String(p.id ?? ""), text: String(p.text ?? "") });
      else if (e === "snap") {
        const s = p as unknown as Snap & { mode?: Mode };
        setSnap(s);
        if (s.mode !== undefined && s.mode !== modeRef.current) {
          modeRef.current = s.mode;
          setMode(s.mode);
        }
      }
    },
    [showFinger],
  );
  useEffect(() => {
    if (!channel || !started || test) return;
    return stageListen(channel, onEvent, setLink);
  }, [channel, started, test, onEvent]);
  // Development only: lets a local check feed events without the Realtime channel.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !started) return;
    (window as unknown as { __stageEvent?: typeof onEvent }).__stageEvent =
      onEvent;
  }, [started, onEvent]);

  if (test === null) return null;

  if (!test && locked)
    return (
      <main className="stg-center">
        <MerchantKey what="The studio screen" onDone={findChannel} stage />
        <style>{css}</style>
      </main>
    );

  if (!test && !channel)
    return (
      <main className="stg-center">
        <p>
          {chanError
            ? `Cannot reach Pay Alone (${chanError}).`
            : "Opening the studio feed…"}
        </p>
        {chanError && <button onClick={findChannel}>Try again</button>}
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
        <span className="stg-start-title">Pay Alone · studio screen</span>
        <span>
          Click to start (this turns the sound on and goes full screen)
        </span>
        <style>{css}</style>
      </button>
    );

  const live = lastSeen > 0 && now - lastSeen < 6000;
  const req = snap?.pending ?? snap?.last ?? null;
  const st = req
    ? (STATUS[req.status] ?? { text: req.status, tone: "wait" as const })
    : null;
  const fingerAsked = Boolean(
    req &&
    snap?.pending &&
    ((finger && finger.state === "ask") ||
      (prompt?.id === req.id && /finger|Home button/i.test(prompt.text))),
  );
  const name = snap?.name ?? "Customer";
  const level = () =>
    Math.min(
      1,
      modeRef.current === "speaking"
        ? (player.current?.level() ?? 0) * 4
        : modeRef.current === "listening"
          ? micLevel.current * 2.2
          : 0,
    );
  const devW = fit.w * fit.scale;
  const devH = fit.h * fit.scale;

  return (
    <main className="stg">
      <section className="stg-grid">
        <div className="stg-left">
          <div className="stg-tag">
            <span className="stg-avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span className="stg-tag-text">
              <b>{name}</b>
              <small>The customer · she is blind · her iPad</small>
            </span>
            <span className={`stg-live ${test ? "test" : live ? "on" : ""}`}>
          {test
            ? "TEST PATTERN · not live · made-up payment"
            : live
              ? "● LIVE from the iPad"
              : link === "SUBSCRIBED"
                ? "Waiting for the iPad…"
                : `Connecting (${link})…`}
        </span>
          </div>
          <div className="stg-area" ref={area}>
            <div
              className="stg-ipad"
              style={{ width: devW + 28, height: devH + 28 }}
            >
              <div className="stg-glass" style={{ width: devW, height: devH }}>
                <iframe
                  ref={frameRef}
                  title="Live copy of the customer's screen"
                  sandbox="allow-same-origin"
                  srcDoc={
                    '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'
                  }
                  style={{
                    width: fit.w,
                    height: fit.h,
                    transform: `scale(${fit.scale})`,
                  }}
                />
                <div
                  ref={orbBox}
                  className="stg-orb-over"
                  style={{ display: orb ? "block" : "none" }}
                >
                  {orb && (
                    <GlassOrb
                      mode={orb.mode}
                      level={orb.mode !== "idle" ? level : undefined}
                      size="100%"
                    />
                  )}
                </div>
                {!hasScreen && (
                  <div className="stg-wait">
                    {test ? (
                      <>
                        <b>Test pattern</b>
                        <span>
                          The iPad&apos;s screen appears here when it is live.
                        </span>
                      </>
                    ) : (
                      <>
                        <b>Waiting for the iPad&apos;s screen</b>
                        <span>
                          On the iPad, open Pay Alone in stage mode
                          (payalone.vercel.app/wallet?stage=1).
                        </span>
                      </>
                    )}
                  </div>
                )}
                {finger && <FingerSheet f={finger} />}
              </div>
            </div>
          </div>
        </div>
        <div className="stg-divider" aria-hidden="true">
          <span>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h14l-3-3M20 16H6l3 3" /></svg>
          </span>
        </div>
        <aside className="stg-right">
          <div className="stg-tag">
            <span className="stg-avatar">{(req?.merchantName ?? "Mama Chris").slice(0, 1).toUpperCase()}</span>
            <span className="stg-tag-text">
              <b>{req?.merchantName ?? "Mama Chris"}</b>
              <small>{req?.outgoing ? "Receiving the money" : "The seller · her shop"}</small>
            </span>
          </div>
          <div className={`stg-card ${st?.tone ?? "wait"}`}>
            {req ? (
              <>
                <div className="stg-card-what">
                  {req.outgoing ? `${name} sends` : `Asked ${name} for`}
                </div>
                <div className="stg-card-amt">
                  <sup>$</sup>
                  {formatAmount(req.amount).replace(/^[A-Z]{3}\s?/, "")}
                </div>
                {nairaOf(req.amount) && (
                  <div className="stg-card-ngn">≈ ₦{nairaOf(req.amount)}</div>
                )}
                <div className={`stg-pill ${st?.tone}`}>
                  {req.status === "paid" ? "✓ " : ""}
                  {fingerAsked && req.status !== "paid"
                    ? `Waiting for ${name}'s fingerprint`
                    : st?.text}
                </div>
                {req.status === "paid" && req.receive && (
                  <div className="stg-card-sub">
                    {money(req.receive)} received over Interledger
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="stg-card-what">No payment yet</div>
                <div className="stg-card-sub">
                  A request appears here the moment it is sent.
                </div>
              </>
            )}
          </div>
          <div className="stg-marea" ref={marea}>
            <div className="stg-phone" style={{ width: mfit.w * mfit.scale + 20, height: mfit.h * mfit.scale + 20 }}>
              <div className="stg-glass phone" style={{ width: mfit.w * mfit.scale, height: mfit.h * mfit.scale }}>
                <iframe
                  ref={mframeRef}
                  title="Live copy of the seller's screen"
                  sandbox="allow-same-origin"
                  srcDoc={'<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'}
                  style={{ width: mfit.w, height: mfit.h, transform: `scale(${mfit.scale})` }}
                />
                {!hasMerchant && (
                  <div className="stg-wait small">
                    <b>Mama Chris&apos;s phone</b>
                    <span>Appears here when she opens the seller page (payalone.vercel.app/merchant).</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="stg-mode">
            <span className={`stg-dot ${mode}`} />
            {mode === "speaking"
              ? "Pay Alone is speaking"
              : mode === "listening"
                ? `Listening to ${name}`
                : mode === "connecting"
                  ? "Connecting the voice…"
                  : "Voice ready"}
          </div>
          <p className="stg-foot">
            Interledger Open Payments · test network · money moves in US
            dollars; naira shown at the CBN rate of 16 Nov (₦1,353.97 per $1)
          </p>
        </aside>
      </section>
      <style>{css}</style>
    </main>
  );
}

/** A copy of the iPad's Touch ID sheet: asking, approved (green tick) or not recognised (red shake). */
function FingerSheet({ f }: { f: NonNullable<Finger> }) {
  const amt = f.amount ? formatAmount(f.amount) : "";
  return (
    <div className="fp-dim" key={`${f.state}-${f.at}`}>
      <div
        className={`fp-sheet ${f.state}`}
        role="status"
        aria-live="assertive"
      >
        <div className="fp-icon">
          {f.state === "ok" ? (
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle className="fp-ring" cx="32" cy="32" r="27" />
              <path className="fp-tick" d="M19 33l9 9 17-19" />
            </svg>
          ) : (
            <svg viewBox="0 0 64 64" aria-hidden="true" className="fp-print">
              <path d="M14 26c3-9 10-14 18-14 9 0 16 5 19 13" />
              <path d="M18 50c-3-5-4-10-4-16 0-10 8-18 18-18s18 8 18 18" />
              <path d="M24 55c-3-6-5-12-5-19 0-7 6-13 13-13s13 6 13 13c0 5-1 10-3 14" />
              <path d="M30 57c-3-7-5-13-5-20 0-4 3-7 7-7s7 3 7 7c0 6 1 11 4 16" />
              <path d="M32 37c0 8 2 14 7 20" />
              {f.state === "ask" && (
                <rect
                  className="fp-scan"
                  x="10"
                  y="10"
                  width="44"
                  height="3"
                  rx="1.5"
                />
              )}
            </svg>
          )}
        </div>
        <b className="fp-title">
          {f.state === "ok"
            ? "Approved"
            : f.state === "fail"
              ? "Not recognised"
              : "Touch ID for “Pay Alone”"}
        </b>
        <span className="fp-sub">
          {f.state === "fail"
            ? "This fingerprint is not Gloria's. Nothing was paid."
            : `Pay ${amt}${f.merchant ? ` to ${f.merchant}` : ""}`}
        </span>
        {f.state === "ask" && <span className="fp-cancel">Cancel</span>}
      </div>
    </div>
  );
}

const css = `
body { margin: 0; background: #eaf2e5; }
.stg, .stg-center, .stg-start { position: fixed; inset: 0; z-index: 1000; max-width: none; margin: 0; background: #eaf2e5; color: #0c2a21; font-family: var(--font-sans, system-ui), sans-serif; }
.stg-center { display: grid; place-content: center; justify-items: center; gap: 1rem; padding: 2rem; }
.stg-start { width: 100%; border: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; font-size: 1.4rem; cursor: pointer; }
.stg-start-title { font-size: 3rem; font-weight: 700; color: #0f3b30; letter-spacing: -0.02em; }
.stg { display: flex; flex-direction: column; padding: 0; box-sizing: border-box; overflow: hidden; }
.stg-brand { display: inline-flex; align-items: center; gap: .6rem; font-weight: 700; font-size: 1.3rem; color: #5a3d10; }
.stg-logo { display: grid; place-items: center; width: 2.1rem; height: 2.1rem; border-radius: .7rem; background: #0f3b30; }
.stg-live { margin-left: auto; font-weight: 600; font-size: 1rem; padding: .45rem 1rem; border-radius: 999px; background: rgba(255,255,255,.12); color: #cfe3da; white-space: nowrap; }
.stg-live.on { background: #fff; color: #0f3b30; }
.stg-live.on::first-letter { color: #e5322d; }
.stg-live.test { background: #fde7c8; color: #7a4a00; }
/* Two worlds, side by side: Gloria's in deep green, Mama Chris's in warm sand, with a hard line between. */
.stg-grid { flex: 1; display: grid; grid-template-columns: 2fr 10px 1fr; min-height: 0; }
.stg-left, .stg-right { position: relative; display: flex; flex-direction: column; gap: .8rem; min-height: 0; padding: 1.3rem 1.6rem 1.4rem; }
.stg-left { background: #0f3b30 radial-gradient(rgba(195,232,143,.09) 1.4px, transparent 1.6px) 0 0 / 22px 22px; color: #fff; }
.stg-right { background: #f6e5c8 radial-gradient(rgba(150,95,20,.10) 1.4px, transparent 1.6px) 0 0 / 22px 22px; color: #3d2a0c; }
.stg-divider { position: relative; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.06); }
.stg-divider span { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: grid; place-items: center; width: 4rem; height: 4rem; border-radius: 50%; background: #fff; color: #0f3b30; box-shadow: 0 8px 24px rgba(0,0,0,.18); z-index: 3; }
.stg-tag { display: flex; align-items: center; gap: .9rem; }
.stg-avatar { display: grid; place-items: center; width: 3.3rem; height: 3.3rem; border-radius: 50%; font-weight: 700; font-size: 1.5rem; flex: none; }
.stg-left .stg-avatar { background: #c3e88f; color: #0f3b30; }
.stg-right .stg-avatar { background: #e09a2d; color: #fff; }
.stg-tag-text { display: grid; line-height: 1.15; }
.stg-tag-text b { font-size: 2rem; font-weight: 700; letter-spacing: -.01em; }
.stg-tag-text small { font-size: 1.05rem; opacity: .75; }
.stg-left .stg-tag-text b { color: #fff; }
.stg-right .stg-tag-text b { color: #5a3d10; }
.stg-brandrow { margin-top: auto; }
.stg-area { flex: 1; min-height: 0; display: grid; place-items: center; }
.stg-ipad { box-sizing: border-box; padding: 14px; border-radius: 34px; background: #0a0f0d; box-shadow: 0 30px 70px rgba(0, 0, 0, .45), 0 0 0 2px rgba(195, 232, 143, .35), inset 0 0 0 2px #2c3a36; }
.stg-glass { position: relative; overflow: hidden; border-radius: 20px; background: #f4f8f1; }
.stg-glass iframe { position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; background: #f4f8f1; }
.stg-orb-over { position: absolute; z-index: 1; pointer-events: none; }
.stg-wait { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: .5rem; color: #4b5f57; padding: 2rem; }
.stg-wait b { font-size: 1.6rem; color: #0f3b30; }
.stg-card { border-radius: 1.3rem; background: #fffaf1; border: 2px solid #ecd3a6; padding: .9rem 1.2rem 1rem; display: grid; gap: .2rem; box-shadow: 0 14px 34px rgba(15, 59, 48, .08); }
.stg-card.good { background: #0f3b30; color: #fff; }
.stg-card-what { font-size: 1.1rem; opacity: .7; }
.stg-card-amt { font-size: clamp(2rem, 2.8vw, 3rem); font-weight: 500; letter-spacing: -.03em; line-height: 1; }
.stg-card-amt sup { font-size: .4em; opacity: .7; vertical-align: top; position: relative; top: .3em; margin-right: .1em; }
.stg-card-ngn { font-size: 1.3rem; font-weight: 500; opacity: .75; }
.stg-pill { width: fit-content; margin-top: .4rem; padding: .5rem 1rem; border-radius: 999px; font-weight: 700; font-size: 1.15rem; background: #eef3ea; color: #0f3b30; }
.stg-pill.go { background: #e4eefc; color: #1d4f91; }
.stg-pill.good { background: #c3e88f; color: #0f3b30; font-size: 1.5rem; }
.stg-pill.bad { background: #fde3df; color: #a2271b; }
.stg-card-sub { font-size: 1rem; opacity: .75; }
.stg-mode { display: flex; align-items: center; gap: .6rem; padding: .6rem 1rem; border-radius: 1.2rem; background: #fffaf1; font-weight: 600; color: #5a3d10; }
.stg-dot { width: .8rem; height: .8rem; border-radius: 50%; background: #b9c7bf; }
.stg-dot.speaking { background: #2a8fe0; animation: stg-pulse 1s ease-in-out infinite; }
.stg-dot.listening { background: #11a88f; animation: stg-pulse 1s ease-in-out infinite; }
@keyframes stg-pulse { 50% { transform: scale(1.5); opacity: .6; } }
.stg-marea { flex: 1; min-height: 0; display: grid; place-items: center; }
.stg-phone { box-sizing: border-box; padding: 10px; border-radius: 30px; background: #0a0f0d; box-shadow: 0 20px 50px rgba(90, 61, 16, .3), 0 0 0 2px rgba(224, 154, 45, .45); }
.stg-glass.phone { border-radius: 22px; background: #fff; }
.stg-wait.small b { font-size: 1.2rem; }
.stg-wait.small { font-size: .9rem; padding: 1rem; }
.stg-foot { margin: 0; font-size: .85rem; color: #7a6036; }

.fp-dim { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: rgba(0, 0, 0, .28); animation: fp-fade .2s ease-out; }
.fp-sheet { width: clamp(15rem, 34%, 20rem); padding: 1.6rem 1.4rem 1.2rem; border-radius: 1.2rem; background: rgba(250, 250, 250, .96); box-shadow: 0 20px 50px rgba(0, 0, 0, .3); display: grid; justify-items: center; gap: .45rem; text-align: center; color: #111; animation: fp-pop .28s cubic-bezier(.2, 1.4, .4, 1); font-family: -apple-system, system-ui, sans-serif; }
.fp-icon svg { width: 4.6rem; height: 4.6rem; overflow: visible; }
.fp-print path { fill: none; stroke: #ff375f; stroke-width: 3; stroke-linecap: round; }
.fp-scan { fill: #ff375f; opacity: .55; animation: fp-scan 1.6s ease-in-out infinite; }
.fp-sheet.ask .fp-print { animation: fp-breathe 1.6s ease-in-out infinite; }
.fp-title { font-size: 1.15rem; font-weight: 600; }
.fp-sub { font-size: .95rem; color: #555; }
.fp-cancel { margin-top: .6rem; padding-top: .7rem; width: 100%; border-top: 1px solid #ddd; color: #0a7aff; font-size: 1.05rem; }
.fp-sheet.ok .fp-title { color: #0b8a4f; font-size: 1.4rem; }
.fp-ring { fill: #34c759; stroke: #34c759; stroke-width: 3; transform-origin: 32px 32px; animation: fp-ring .35s ease-out both; }
.fp-tick { fill: none; stroke: #fff; stroke-width: 5.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 48; stroke-dashoffset: 48; animation: fp-draw .4s .25s ease-out forwards; }
.fp-sheet.ok { animation: fp-pop .28s cubic-bezier(.2, 1.4, .4, 1), fp-glow 1.2s .3s ease-out; }
.fp-sheet.fail { animation: fp-shake .5s cubic-bezier(.36, .07, .19, .97) both; }
.fp-sheet.fail .fp-print path { stroke: #d70015; }
.fp-sheet.fail .fp-title { color: #d70015; font-size: 1.35rem; }
@keyframes fp-fade { from { opacity: 0; } }
@keyframes fp-pop { from { transform: scale(1.12); opacity: 0; } }
@keyframes fp-scan { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(42px); } }
@keyframes fp-breathe { 50% { transform: scale(1.05); } }
@keyframes fp-ring { from { transform: scale(.3); opacity: 0; } }
@keyframes fp-draw { to { stroke-dashoffset: 0; } }
@keyframes fp-glow { 0% { box-shadow: 0 0 0 0 rgba(52, 199, 89, .6), 0 20px 50px rgba(0,0,0,.3); } 100% { box-shadow: 0 0 0 28px rgba(52, 199, 89, 0), 0 20px 50px rgba(0,0,0,.3); } }
@keyframes fp-shake { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-9px); } 40%, 60% { transform: translateX(9px); } }
@media (max-width: 900px) { .stg { overflow: auto; } .stg-grid { grid-template-columns: 1fr; } .stg-divider { height: 10px; } }
`;
