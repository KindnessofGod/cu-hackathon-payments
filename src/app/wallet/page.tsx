"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorText, type ApiError } from "@/lib/client";
import { formatAmount, speakAmount, type Amount } from "@/lib/money";
import { BrowserSpeechOutput } from "@/lib/speech";

interface CapView {
  status: "active" | "stopped";
  limit: Amount;
  every: "day" | "week";
  spent: Amount;
  left: Amount;
  periodEnds: string | null;
  walletReportedSpent?: Amount;
}

interface CustomerView {
  payCode: string;
  walletAddress: string;
  name: string | null;
  assetCode: string;
  assetScale: number;
  cap: CapView | null;
}

interface RequestView {
  id: string;
  status: "waiting" | "quoted" | "consent" | "paying" | "paid" | "declined" | "expired" | "failed";
  merchantName: string;
  knownPayee: boolean;
  timesPaidBefore: number;
  requested: Amount;
  debitAmount?: Amount;
  receiveAmount?: Amount;
  challenge?: string;
  paid?: { debitAmount: Amount; receiveAmount: Amount; at: string };
  failure?: { kind: string; message: string; walletSaid?: string };
  expiresAt: string;
  needsWalletConsent: boolean;
}

interface State {
  simulated: boolean;
  customer: CustomerView | null;
  suggestedWalletAddress?: string;
  pending?: RequestView | null;
  last?: RequestView | null;
}

const voice = new BrowserSpeechOutput();

function requestSentence(r: RequestView): string {
  const who = r.knownPayee ? r.merchantName : `A new person you have never paid, called ${r.merchantName},`;
  if (!r.debitAmount || !r.receiveAmount) return `${who} is asking for ${speakAmount(r.requested)}. Getting the exact amount from your wallet.`;
  return `${who} is asking for ${speakAmount(r.receiveAmount)}. ${speakAmount(r.debitAmount)} will leave your account.`;
}

function resultSentence(r: RequestView, cap: CapView | null): string {
  if (r.status === "paid" && r.paid) {
    const left = cap?.status === "active" ? ` ${speakAmount(cap.left)} is left of your limit for this ${cap.every}.` : "";
    return `Paid. ${speakAmount(r.paid.debitAmount)} left your account for ${r.merchantName}.${left}`;
  }
  if (r.status === "declined") return `Not paid. ${r.failure?.message ?? "No money moved."}`;
  if (r.status === "expired") return "Not paid. The request ran out of time. No money moved.";
  if (r.status === "failed") return `Not paid. ${r.failure?.message ?? "The payment failed."} No money moved.`;
  return "";
}

export default function WalletPage() {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<{ text: string; good: boolean; walletSaid?: string } | null>(null);
  const [appVoice, setAppVoice] = useState(true);
  const spokenFor = useRef<string>("");

  const say = useCallback(
    (text: string) => {
      if (appVoice && text) void voice.speak(text);
    },
    [appVoice],
  );

  const refresh = useCallback(async () => {
    try {
      const s = await api<State>("/api/wallet/state");
      setLoadError(null);
      setState(s);
      return s;
    } catch (e) {
      setLoadError(errorText(e));
      return null;
    }
  }, []);

  useEffect(() => {
    setAppVoice(window.localStorage.getItem("appVoice") !== "off");
    const q = new URLSearchParams(window.location.search);
    const outcome = q.get("outcome");
    if (outcome) {
      const message = q.get("message") ?? "";
      const text =
        outcome === "cap_set"
          ? "Your spending limit is set. From now on you approve payments here, without leaving this app."
          : outcome === "paid"
            ? "Paid."
            : outcome === "declined"
              ? `Not paid. ${message || "You did not give permission. No money moved."}`
              : `That did not work. ${message}`;
      setNotice({ text, good: outcome === "cap_set" || outcome === "paid" });
      window.history.replaceState(null, "", "/wallet");
    }
    void refresh();
  }, [refresh]);

  // Poll for new requests. The Open Payments API has no push to clients, so the app asks.
  useEffect(() => {
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]);

  // Speak a new request once when it arrives with its exact amount.
  const pending = state?.pending ?? null;
  useEffect(() => {
    if (pending && pending.debitAmount && spokenFor.current !== pending.id) {
      spokenFor.current = pending.id;
      say(`${requestSentence(pending)} Tap anywhere to hear this again.`);
    }
  }, [pending, say]);

  const finish = useCallback(
    async (r: RequestView) => {
      const s = await refresh();
      const text = resultSentence(r, s?.customer?.cap ?? null);
      setNotice({ text, good: r.status === "paid", walletSaid: r.failure?.walletSaid });
      say(text);
    },
    [refresh, say],
  );

  if (loadError && !state) {
    return (
      <main>
        <h1>Customer</h1>
        <div className="status bad" role="alert">
          <p>{loadError.message}</p>
          <button onClick={() => void refresh()}>Try again</button>
        </div>
      </main>
    );
  }
  if (!state) {
    return (
      <main>
        <h1>Customer</h1>
        <p role="status">Loading…</p>
      </main>
    );
  }
  if (!state.customer) return <Setup suggested={state.suggestedWalletAddress ?? ""} simulated={state.simulated} onDone={() => void refresh()} />;

  if (pending) return <Approve key={pending.id} request={pending} say={say} onDone={finish} />;

  return (
    <Home
      customer={state.customer}
      notice={notice}
      loadError={loadError}
      appVoice={appVoice}
      setAppVoice={(on) => {
        setAppVoice(on);
        window.localStorage.setItem("appVoice", on ? "on" : "off");
        if (!on) voice.stop();
      }}
      say={say}
      refresh={() => void refresh()}
      setNotice={setNotice}
    />
  );
}

// ---------- one-time setup ----------

function Setup({ suggested, simulated, onDone }: { suggested: string; simulated: boolean; onDone: () => void }) {
  const [walletAddress, setWalletAddress] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/wallet/setup", { method: "POST", body: { walletAddress } });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <main>
      <p>
        <Link href="/">Back</Link>
      </p>
      <h1>Set up this device</h1>
      <p>This is done once. Enter the wallet address you pay from.</p>
      <form onSubmit={submit} className="card">
        <label htmlFor="wa">Your wallet address</label>
        <input id="wa" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} />
        <p className="muted">
          {simulated
            ? "Simulated mode: any address on the pretend wallet works, for example the one filled in."
            : "Use a wallet address from the Interledger test wallet, for example https://ilp.interledger-test.dev/yourname."}
        </p>
        {error && (
          <div className="status bad" role="alert">
            <p>{error.message}</p>
            {error.walletSaid && <p className="muted">The wallet said: {error.walletSaid}</p>}
          </div>
        )}
        <button className="wide" disabled={busy}>
          {busy ? "Checking the wallet…" : "Use this wallet"}
        </button>
      </form>
    </main>
  );
}

// ---------- approving one request: the whole screen is one button ----------

function Approve({ request, say, onDone }: { request: RequestView; say: (t: string) => void; onDone: (r: RequestView) => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ready = Boolean(request.challenge && request.debitAmount);
  const sentence = useMemo(() => requestSentence(request), [request]);
  const consentNote = request.needsWalletConsent ? " You have no spending limit yet, so your wallet will ask you to confirm this one payment on its own page." : "";

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // An armed approval goes back to sleep if nothing happens. Doing nothing never pays.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 20000);
    return () => clearTimeout(t);
  }, [armed]);

  async function activate() {
    if (busy || !ready) {
      say(sentence);
      return;
    }
    if (!armed) {
      setArmed(true);
      const text = `${sentence}${consentNote} Tap again to pay. To refuse, do nothing.`;
      setMessage(text);
      say(text);
      return;
    }
    setBusy(true);
    setMessage("Paying. Please wait.");
    say("Paying. Please wait.");
    try {
      // ApprovalProvider, today: a confirm action. Planned: a fingerprint passkey signing this same challenge.
      const proof = { method: "confirm-button", challenge: request.challenge };
      const res = await api<{ request: RequestView; redirectUrl?: string }>(`/api/wallet/requests/${request.id}/approve`, { method: "POST", body: { proof } });
      if (res.redirectUrl) {
        setMessage("Opening your wallet's page to confirm this payment.");
        window.location.assign(res.redirectUrl);
        return;
      }
      onDone(res.request);
    } catch (e) {
      const err = errorText(e);
      onDone({ ...request, status: "failed", failure: { kind: err.kind, message: err.message, walletSaid: err.walletSaid } });
    }
  }

  async function refuse() {
    setBusy(true);
    try {
      const res = await api<{ request: RequestView }>(`/api/wallet/requests/${request.id}/decline`, { method: "POST" });
      onDone(res.request);
    } catch (e) {
      const err = errorText(e);
      onDone({ ...request, status: "failed", failure: { kind: err.kind, message: err.message } });
    }
  }

  const instruction = !ready ? "Getting the exact amount from your wallet…" : busy ? "Paying. Please wait." : armed ? "Tap again to pay. To refuse, do nothing." : "Tap anywhere to hear this request.";

  return (
    <div className="takeover" role="dialog" aria-modal="true" aria-label="Payment request">
      <button ref={buttonRef} className={`approve ${armed ? "armed" : ""}`} onClick={() => void activate()} disabled={busy} aria-describedby="approve-how">
        <span>{request.knownPayee ? request.merchantName : `NEW person: ${request.merchantName}`} is asking for</span>
        <span className="amount">{formatAmount(request.receiveAmount ?? request.requested)}</span>
        {request.debitAmount && <span>{formatAmount(request.debitAmount)} will leave your account</span>}
        <span id="approve-how">{instruction}</span>
      </button>
      <div className="sr-only" role="status" aria-live="assertive">
        {message}
      </div>
      <button className="refuse" onClick={() => void refuse()} disabled={busy}>
        Refuse this request
      </button>
    </div>
  );
}

// ---------- home ----------

function Home(props: {
  customer: CustomerView;
  notice: { text: string; good: boolean; walletSaid?: string } | null;
  loadError: ApiError | null;
  appVoice: boolean;
  setAppVoice: (on: boolean) => void;
  say: (t: string) => void;
  refresh: () => void;
  setNotice: (n: { text: string; good: boolean; walletSaid?: string } | null) => void;
}) {
  const { customer, notice, say } = props;
  const cap = customer.cap;
  const digits = customer.payCode.split("").join(" ");

  return (
    <main>
      <p>
        <Link href="/">Back</Link>
      </p>
      <h1>Customer</h1>
      <p className="muted">
        Paying from {customer.name ? `${customer.name}, ` : ""}
        {customer.walletAddress} in {customer.assetCode}.
      </p>

      {notice && (
        <div className={`status ${notice.good ? "good" : "bad"}`} role="status" aria-live="polite">
          <p>
            {notice.good ? "✓ " : "✕ "}
            {notice.text}
          </p>
          {notice.walletSaid && <p className="muted">The wallet said: {notice.walletSaid}</p>}
        </div>
      )}
      {props.loadError && <p role="alert">Cannot check for new requests: {props.loadError.message} Still trying.</p>}

      <section className="card" aria-labelledby="code-h">
        <h2 id="code-h">Your pay code</h2>
        <p>Show this to a seller so they can ask you for a payment. It cannot take money. Only your approval can.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="qr" src="/api/wallet/paycode" alt={`QR code for pay code ${digits}`} />
        <p className="code" aria-label={`Pay code ${digits}`}>
          {customer.payCode}
        </p>
        <button className="wide secondary" onClick={() => say(`Your pay code is ${digits}. Again: ${digits}.`)}>
          Say my pay code aloud
        </button>
        <LockScreenPicture payCode={customer.payCode} />
      </section>

      <Limit cap={cap} customer={customer} refresh={props.refresh} say={say} setNotice={props.setNotice} />

      <section className="card" aria-labelledby="set-h">
        <h2 id="set-h">Settings</h2>
        <label style={{ display: "flex", gap: "0.8rem", alignItems: "center", fontWeight: 400 }}>
          <input type="checkbox" style={{ width: "1.6rem", height: "1.6rem" }} checked={props.appVoice} onChange={(e) => props.setAppVoice(e.target.checked)} />
          <span>The app speaks aloud. Turn this off if you use VoiceOver or TalkBack, which already read the screen.</span>
        </label>
        <p className="muted">The voice is the device&apos;s built-in English voice, used as a placeholder. Nigerian-language voices are planned.</p>
        <button
          className="secondary"
          onClick={async () => {
            await api("/api/wallet/setup", { method: "DELETE" });
            props.refresh();
          }}
        >
          Forget this device
        </button>
      </section>
    </main>
  );
}

function Limit({
  cap,
  customer,
  refresh,
  say,
  setNotice,
}: {
  cap: CapView | null;
  customer: CustomerView;
  refresh: () => void;
  say: (t: string) => void;
  setNotice: (n: { text: string; good: boolean; walletSaid?: string } | null) => void;
}) {
  const [amount, setAmount] = useState("");
  const [every, setEvery] = useState<"week" | "day">("week");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  async function setLimit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { redirectUrl } = await api<{ redirectUrl: string }>("/api/wallet/cap", { method: "POST", body: { amount, every } });
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  async function stop() {
    if (!confirmStop) {
      setConfirmStop(true);
      say("Tap again to stop all payments from this app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/wallet/stop", { method: "POST" });
      const text = "Stopped. This app can no longer pay from your wallet until you set a new limit.";
      setNotice({ text, good: true });
      say(text);
      refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      setConfirmStop(false);
    }
  }

  return (
    <section className="card" aria-labelledby="limit-h">
      <h2 id="limit-h">Your spending limit</h2>
      {cap?.status === "active" ? (
        <>
          <p>
            You allowed up to <strong>{formatAmount(cap.limit)}</strong> every {cap.every}. Your wallet enforces this, not this app.
          </p>
          <dl className="facts">
            <dt>Spent this {cap.every}, by our record</dt>
            <dd>{formatAmount(cap.spent)}</dd>
            <dt>Left of your limit</dt>
            <dd className="amount">{formatAmount(cap.left)}</dd>
            {cap.walletReportedSpent && (
              <>
                <dt>Spent, as last reported by the wallet</dt>
                <dd>{formatAmount(cap.walletReportedSpent)}</dd>
              </>
            )}
          </dl>
          <p className="muted">This is what is left of your limit, not your account balance. Open Payments does not let an app read a balance.</p>
          <button className="wide secondary" onClick={() => say(`${speakAmount(cap.left)} is left of your limit of ${speakAmount(cap.limit)} for this ${cap.every}.`)}>
            Say what is left aloud
          </button>
          <button className="wide danger" disabled={busy} onClick={() => void stop()}>
            {confirmStop ? "Tap again to stop everything" : "Stop everything"}
          </button>
        </>
      ) : (
        <form onSubmit={setLimit}>
          <p>
            {cap?.status === "stopped" ? "You stopped all payments. " : ""}
            Set a limit once on your wallet&apos;s own page. After that you approve each payment here, and your wallet refuses anything over the limit.
          </p>
          <p className="muted">Without a limit, every payment sends you to your wallet&apos;s page to confirm.</p>
          <label htmlFor="cap-amount">Limit in {customer.assetCode}</label>
          <input id="cap-amount" inputMode="decimal" autoComplete="off" required placeholder="20000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <label htmlFor="cap-every">Every</label>
          <select id="cap-every" value={every} onChange={(e) => setEvery(e.target.value === "day" ? "day" : "week")}>
            <option value="week">Week</option>
            <option value="day">Day</option>
          </select>
          <button className="wide" disabled={busy} style={{ marginTop: "1rem" }}>
            {busy ? "Opening your wallet…" : "Set my limit on the wallet's page"}
          </button>
        </form>
      )}
      {error && (
        <div className="status bad" role="alert">
          <p>{error.message}</p>
          {error.walletSaid && <p className="muted">The wallet said: {error.walletSaid}</p>}
        </div>
      )}
    </section>
  );
}

/** Makes a picture with the pay code low on the screen, to set as the lock-screen wallpaper. */
function LockScreenPicture({ payCode }: { payCode: string }) {
  const [problem, setProblem] = useState("");

  async function make() {
    setProblem("");
    try {
      const svg = await (await fetch("/api/wallet/paycode", { cache: "no-store" })).text();
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image"));
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      });
      const w = 1668;
      const h = 2224; // iPad Air 3 portrait
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      const size = 900;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, (w - size) / 2, h - size - 420, size, size); // below the clock, above the bottom edge
      ctx.fillStyle = "#10172a";
      ctx.font = "bold 96px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Pay code ${payCode.split("").join(" ")}`, w / 2, h - 260);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "pay-code-lock-screen.png";
      a.click();
    } catch {
      setProblem("Could not make the picture on this device.");
    }
  }

  return (
    <>
      <button className="wide secondary" onClick={() => void make()}>
        Make a lock-screen picture of my pay code
      </button>
      {problem && <p role="alert">{problem}</p>}
    </>
  );
}
