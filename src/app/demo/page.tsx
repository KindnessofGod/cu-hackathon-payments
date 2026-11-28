"use client";
// Try Pay Alone on ONE device. A SIMULATED customer (limit already set) and a SIMULATED seller side by side,
// no setup wall. Voice has three states: locked, your own ElevenLabs key, or approved judge access.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppBar, Icon } from "@/components/ui";
import { api, errorText } from "@/lib/client";

type Voice = "open" | "judge" | "byok" | "locked";
type Session = { demo: boolean; voice: Voice };
type JudgeStatus = { status: "pending" | "approved" | "denied"; expiresAt?: string; usage?: { agent: number; speak: number; listen: number }; limits?: { agent: number } };
const JUDGE_KEY = "pa_judge";

function readJudge(): { id: string; token: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(JUDGE_KEY) ?? "null");
    return v?.id && v?.token ? v : null;
  } catch {
    return null;
  }
}
function saveJudge(v: { id: string; token: string } | null) {
  try {
    if (v) localStorage.setItem(JUDGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(JUDGE_KEY);
  } catch {
    /* private mode: the request still works, it just will not survive a reload */
  }
}

export default function DemoPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [frame, setFrame] = useState(0); // changing this reloads both panes
  const [tab, setTab] = useState<"customer" | "seller">("customer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"" | "key" | "judge">("");
  const [judge, setJudge] = useState<JudgeStatus | null>(null);
  const prevVoice = useRef<Voice | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSession(await api<Session>("/api/demo/session"));
    } catch (e) {
      setError(errorText(e).message);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  // A new voice state (key saved, judge approved) restarts the panes so the app picks it up.
  useEffect(() => {
    if (session && prevVoice.current && prevVoice.current !== session.voice && session.demo) setFrame((f) => f + 1);
    if (session) prevVoice.current = session.voice;
  }, [session]);

  // Judge request: poll until the owner decides.
  const poll = useCallback(async () => {
    const mine = readJudge();
    if (!mine) return;
    try {
      const s = await api<JudgeStatus>("/api/judge/status", { method: "POST", body: mine });
      setJudge(s);
      if (s.status === "approved") void refresh();
    } catch {
      saveJudge(null);
      setJudge(null);
    }
  }, [refresh]);
  useEffect(() => void poll(), [poll]);
  useEffect(() => {
    if (judge?.status !== "pending") return;
    const t = setInterval(() => void poll(), 5000);
    return () => clearInterval(t);
  }, [judge?.status, poll]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      await api("/api/demo/start", { method: "POST", body: {} });
      await refresh();
      setFrame((f) => f + 1);
    } catch (e) {
      setError(errorText(e).message);
    } finally {
      setBusy(false);
    }
  }
  async function restart() {
    await api("/api/demo/start", { method: "DELETE" }).catch(() => undefined);
    await start();
  }

  const voice = session?.voice ?? "locked";
  return (
    <>
      <AppBar />
      <main className="demo5">
        <header className="d5-hero">
          <div>
            <p className="kick">Judge demo · simulated wallet</p>
            <h1>Try Pay Alone <em>on this one device.</em></h1>
            <p className="lead">
              A customer and a seller, side by side. The customer already has a weekly limit. Ask for a payment as the seller, hear it as the customer, and approve
              it. Everything here runs on a <strong>simulated</strong> wallet with play money: no real money moves, and the AI never approves or pays.
            </p>
          </div>
          <ol className="d5-steps" aria-label="How to try it">
            <li><span aria-hidden="true">01</span><b>Seller</b> Tap the demo customer, type an amount (try 2000), send the request.</li>
            <li><span aria-hidden="true">02</span><b>Customer</b> The request appears and is read back with the exact amount. Approve it with a tap, or your fingerprint if you turn it on.</li>
            <li><span aria-hidden="true">03</span><b>Seller</b> Watch it become &ldquo;received&rdquo;.</li>
          </ol>
        </header>

        <section className="d5-access" aria-labelledby="voice-h">
          <div className="d5-access-head">
            <h2 id="voice-h">Voice</h2>
            <p className="muted">
              {voice === "locked"
                ? "Voice uses paid speech services, so it is locked until you choose one way to unlock it. Touch only works the same."
                : "Voice is on for this browser."}
            </p>
          </div>
          {voice === "judge" && (
            <p className="status good" role="status">
              <span className="status-icon"><Icon name="check" size={18} /></span>
              <span>Live voice is unlocked for you (judge access{judge?.limits ? `, up to ${judge.limits.agent} live conversations` : ""}).</span>
            </p>
          )}
          {voice === "byok" && (
            <p className="status good" role="status">
              <span className="status-icon"><Icon name="check" size={18} /></span>
              <span>Your own ElevenLabs key is active: the app speaks each request and hears your spoken answer. The live back-and-forth conversation needs judge access.</span>
            </p>
          )}
          {voice === "locked" && (
            <>
              <div className="d5-options">
                <div className="d5-opt on">
                  <span className="d5-opt-ic" aria-hidden="true"><Icon name="finger" size={22} /></span>
                  <b>Touch only</b>
                  <span>Works now. No setup.</span>
                </div>
                <button className={`d5-opt${panel === "judge" ? " sel" : ""}`} aria-expanded={panel === "judge"} onClick={() => setPanel(panel === "judge" ? "" : "judge")}>
                  <span className="d5-opt-ic" aria-hidden="true"><Icon name="person" size={22} /></span>
                  <b>Request judge access</b>
                  <span>Live voice for 24 hours. No key needed.</span>
                </button>
                <button className={`d5-opt${panel === "key" ? " sel" : ""}`} aria-expanded={panel === "key"} onClick={() => setPanel(panel === "key" ? "" : "key")}>
                  <span className="d5-opt-ic" aria-hidden="true"><Icon name="speaker" size={22} /></span>
                  <b>Use my own ElevenLabs key</b>
                  <span>Spoken read-back and answers.</span>
                </button>
              </div>
              {panel === "key" && <KeyForm onSaved={() => { setPanel(""); void refresh(); }} />}
              {panel === "judge" && <JudgeForm judge={judge} onRequested={(s) => { setJudge(s); void poll(); }} />}
            </>
          )}
          {voice !== "locked" && (
            <button className="secondary" onClick={async () => { await api("/api/voice/byok", { method: "DELETE" }).catch(() => undefined); void refresh(); }}>Remove my key from this browser</button>
          )}
        </section>

        {error && <p role="alert" className="status bad"><span>{error}</span></p>}

        <section className="d5-studio" aria-label="The two apps">
          <div className="d5-floor" aria-hidden="true" />
          {!session?.demo ? (
            <div className="d5-start">
              <div className="d5-ghosts" aria-hidden="true"><i /><i /></div>
              <button className="lime-btn" onClick={() => void start()} disabled={busy}>{busy ? "Setting up…" : "Start the demo"}</button>
              <p>Creates a simulated customer with a ₦50,000 weekly limit and a simulated seller, on this browser only.</p>
            </div>
          ) : (
            <>
              <div className="d5-bar">
                <div className="demo-tabs" role="tablist" aria-label="Which side to show on a narrow screen">
                  <button role="tab" aria-selected={tab === "customer"} className={tab === "customer" ? "" : "secondary"} onClick={() => setTab("customer")}>Customer</button>
                  <button role="tab" aria-selected={tab === "seller"} className={tab === "seller" ? "seller" : "secondary"} onClick={() => setTab("seller")}>Seller</button>
                </div>
                <span className="d5-live" aria-hidden="true"><i /> Simulated wallet · play money</span>
                <button className="secondary" onClick={() => void restart()} disabled={busy}>Start over</button>
              </div>
              <div className="demo-stage" data-tab={tab}>
                <div className="demo-col"><span className="demo-label customer"><Icon name="person" size={18} /> Customer · hears and approves</span><iframe key={`c${frame}`} className="demo-pane customer" title="Customer app" src="/wallet" allow="microphone; autoplay; publickey-credentials-get; publickey-credentials-create" /></div>
                <div className="demo-col"><span className="demo-label seller"><Icon name="shop" size={18} /> Seller · asks for payment</span><iframe key={`s${frame}`} className="demo-pane seller" title="Seller app" src="/merchant" allow="camera; autoplay" /></div>
              </div>
            </>
          )}
        </section>
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          Simulated wallet, play money. The real Interledger test-wallet version is the same app: sign in on the customer side with your own test wallet address instead.
        </p>
      </main>
    </>
  );
}

function KeyForm({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/voice/byok", { method: "POST", body: { key } });
      setKey("");
      onSaved();
    } catch (x) {
      setErr(errorText(x).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} style={{ display: "grid", gap: "0.6rem", marginTop: "0.8rem" }}>
      <label htmlFor="elkey">Your ElevenLabs API key</label>
      <input id="elkey" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} required />
      <p className="muted" style={{ margin: 0 }}>
        The key is checked once with ElevenLabs, then kept only in an encrypted cookie in this browser until you close it. Our server forwards each speech request to ElevenLabs with it and never stores or logs it.
        A restricted key (text to speech and speech to text only) is enough, and you can delete it afterwards. It powers the spoken read-back and your spoken answers; the live conversation needs judge access.
      </p>
      {err && <p role="alert" style={{ margin: 0, color: "#b3261e" }}>{err}</p>}
      <button type="submit" disabled={busy || key.length < 20}>{busy ? "Checking…" : "Use this key"}</button>
    </form>
  );
}

function JudgeForm({ judge, onRequested }: { judge: JudgeStatus | null; onRequested: (s: JudgeStatus) => void }) {
  const [f, setF] = useState({ name: "", email: "", competition: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [alerted, setAlerted] = useState(true);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ id: string; pollToken: string; alerted: boolean }>("/api/judge/request", { method: "POST", body: f });
      saveJudge({ id: r.id, token: r.pollToken });
      setAlerted(r.alerted);
      onRequested({ status: "pending" });
    } catch (x) {
      setErr(errorText(x).message);
    } finally {
      setBusy(false);
    }
  }
  if (judge?.status === "pending")
    return (
      <p className="status wait" role="status" style={{ marginTop: "0.8rem" }}>
        <span className="status-icon"><Icon name="clock" size={18} /></span>
        <span>
          Request sent. {alerted ? "The owner has been alerted and usually approves within minutes." : "The owner will see it soon."} Keep this page open: voice unlocks here by itself.
        </span>
      </p>
    );
  if (judge?.status === "denied") return <p className="status bad" role="status" style={{ marginTop: "0.8rem" }}><span>Access was not approved. You can still use your own ElevenLabs key, or the demo without voice.</span></p>;
  return (
    <form onSubmit={send} style={{ display: "grid", gap: "0.6rem", marginTop: "0.8rem" }}>
      <label htmlFor="jn">Your name</label>
      <input id="jn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={80} autoComplete="name" />
      <label htmlFor="je">Email</label>
      <input id="je" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required maxLength={120} autoComplete="email" />
      <label htmlFor="jc">Competition you are judging for</label>
      <input id="jc" value={f.competition} onChange={(e) => setF({ ...f, competition: e.target.value })} required maxLength={120} />
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
      <p className="muted" style={{ margin: 0 }}>Approved judges get live voice for 24 hours, limited to a few conversations. No API key needed. Your details go only to the owner.</p>
      {err && <p role="alert" style={{ margin: 0, color: "#b3261e" }}>{err}</p>}
      <button type="submit" disabled={busy}>{busy ? "Sending…" : "Request access"}</button>
    </form>
  );
}
