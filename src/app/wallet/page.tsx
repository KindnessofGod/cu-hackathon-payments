"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorText, type ApiError } from "@/lib/client";
import { formatAmount, speakAmount, type Amount } from "@/lib/money";
import { BrowserSpeechOutput } from "@/lib/speech";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

interface CapView {
  status: "active" | "stopped";
  limit: Amount;
  every: "day" | "week";
  spent: Amount;
  left: Amount;
  periodEnds: string | null;
  grantedAt: string;
  walletReportedSpent?: Amount;
}

interface CustomerView {
  payCode: string;
  walletAddress: string;
  name: string | null;
  assetCode: string;
  assetScale: number;
  cap: CapView | null;
  fingerprint: { id: string; transports?: string[]; createdAt: string }[];
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
  deviceChallenge?: string;
  paid?: { debitAmount: Amount; receiveAmount: Amount; at: string };
  failure?: { kind: string; message: string; walletSaid?: string };
  expiresAt: string;
  needsWalletConsent: boolean;
}

interface HistoryItem {
  id: string;
  at: string;
  merchantName: string;
  status: RequestView["status"];
  requested: Amount;
  debitAmount?: Amount;
  receiveAmount?: Amount;
  approvedVia?: "limit" | "wallet-page";
  failure?: { kind: string; message: string; walletSaid?: string };
}

interface State {
  simulated: boolean;
  history?: HistoryItem[];
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

  if (pending) return <Approve key={pending.id} request={pending} fingerprint={state.customer.fingerprint} say={say} onDone={finish} />;

  return (
    <Home
      customer={state.customer}
      history={state.history ?? []}
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

function Approve({
  request,
  fingerprint,
  say,
  onDone,
}: {
  request: RequestView;
  fingerprint: CustomerView["fingerprint"];
  say: (t: string) => void;
  onDone: (r: RequestView) => void;
}) {
  const needsFinger = fingerprint.length > 0;
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
      const text = needsFinger
        ? `${sentence}${consentNote} To pay, tap again, then rest your finger on the Home button. To refuse, do nothing.`
        : `${sentence}${consentNote} Tap again to pay. To refuse, do nothing.`;
      setMessage(text);
      say(text);
      return;
    }
    let proof: { method: "confirm-button" | "passkey"; challenge?: string; response?: unknown } = { method: "confirm-button", challenge: request.challenge };
    if (needsFinger) {
      // The device asks for the fingerprint here. Its signature covers this request's challenge only.
      const ask = startAuthentication({
        optionsJSON: {
          challenge: request.deviceChallenge!,
          rpId: window.location.hostname,
          allowCredentials: fingerprint.map((f) => ({ id: f.id, type: "public-key" as const, transports: f.transports as AuthenticatorTransport[] | undefined })),
          userVerification: "required",
          timeout: 60000,
        },
      });
      say("Rest your finger on the Home button.");
      setMessage("Rest your finger on the Home button.");
      try {
        proof = { method: "passkey", challenge: request.challenge, response: await ask };
      } catch {
        setArmed(false);
        const text = "Fingerprint not confirmed. Nothing was paid. Tap the screen to hear the request again.";
        setMessage(text);
        say(text);
        return;
      }
    }
    setBusy(true);
    setMessage("Paying. Please wait.");
    say("Paying. Please wait.");
    try {
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

  const instruction = !ready
    ? "Getting the exact amount from your wallet…"
    : busy
      ? "Paying. Please wait."
      : armed
        ? needsFinger
          ? "Tap again, then rest your finger on the Home button. To refuse, do nothing."
          : "Tap again to pay. To refuse, do nothing."
        : "Tap anywhere to hear this request.";

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
  history: HistoryItem[];
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

      <Fingerprint customer={customer} refresh={props.refresh} say={say} />

      <Limit cap={cap} customer={customer} refresh={props.refresh} say={say} setNotice={props.setNotice} />

      <History items={props.history} say={say} />

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
            <dt>Spent under this limit this {cap.every}, by our record</dt>
            <dd>{formatAmount(cap.spent)}</dd>
            <dt>Left of your limit</dt>
            <dd className="amount">{formatAmount(cap.left)}</dd>
          </dl>
          <p className="muted">
            Counts only payments made through this app since you set the limit on {new Date(cap.grantedAt).toLocaleDateString()}. Payments made before that, or outside this app, are not
            included. This is what is left of your limit, not your account balance: Open Payments does not let an app read a balance.
          </p>
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
          <input id="cap-amount" inputMode="decimal" autoComplete="off" required placeholder={customer.assetCode === "NGN" ? "20000" : "50"} value={amount} onChange={(e) => setAmount(e.target.value)} />
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

// ---------- history ----------

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function historyLine(h: HistoryItem): { title: string; detail: string; good: boolean } {
  const amount = h.debitAmount ?? h.requested;
  switch (h.status) {
    case "paid":
      return {
        title: `Paid ${formatAmount(amount)} to ${h.merchantName}`,
        detail: h.approvedVia === "limit" ? "Approved in this app, under your limit." : "Approved on your wallet's page.",
        good: true,
      };
    case "declined":
      return { title: `Not paid: ${h.merchantName} asked for ${formatAmount(h.receiveAmount ?? h.requested)}`, detail: h.failure?.message ?? "Refused.", good: false };
    case "expired":
      return { title: `Not paid: ${h.merchantName} asked for ${formatAmount(h.receiveAmount ?? h.requested)}`, detail: "The request ran out of time.", good: false };
    case "failed":
      return { title: `Not paid: ${formatAmount(amount)} to ${h.merchantName}`, detail: h.failure?.message ?? "The payment failed.", good: false };
    default:
      return { title: `${h.merchantName}: ${formatAmount(amount)}`, detail: "In progress.", good: false };
  }
}

function spokenHistory(h: HistoryItem): string {
  const amount = h.debitAmount ?? h.requested;
  const day = new Date(h.at).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });
  if (h.status === "paid") return `${day}: paid ${speakAmount(amount)} to ${h.merchantName}.`;
  if (h.status === "failed" && h.failure?.kind === "limit_exceeded") return `${day}: ${h.merchantName} asked for ${speakAmount(amount)}. Your wallet refused it. Over your limit.`;
  return `${day}: ${h.merchantName} asked for ${speakAmount(h.receiveAmount ?? h.requested)}. Not paid.`;
}

function History({ items, say }: { items: HistoryItem[]; say: (t: string) => void }) {
  return (
    <section className="card" aria-labelledby="hist-h">
      <h2 id="hist-h">Your payments</h2>
      <p className="muted">Payments and requests through this app, newest first. Your wallet&apos;s own transaction list is the full record.</p>
      {items.length === 0 ? (
        <p>No payments yet.</p>
      ) : (
        <>
          <button
            className="wide secondary"
            onClick={() => {
              const lastThree = items.slice(0, 3).map(spokenHistory).join(" ");
              say(`Your last ${Math.min(3, items.length)} payments. ${lastThree}`);
            }}
          >
            Say my last payments aloud
          </button>
          <ol className="history">
            {items.map((h) => {
              const line = historyLine(h);
              return (
                <li key={h.id} className={line.good ? "good" : "bad"}>
                  <span className="mark" aria-hidden="true">
                    {line.good ? "✓" : "✕"}
                  </span>
                  <div>
                    <p className="title">{line.title}</p>
                    <p className="muted">
                      <time dateTime={h.at}>{when(h.at)}</time>. {line.detail}
                    </p>
                    {h.failure?.walletSaid && <p className="muted">The wallet said: {h.failure.walletSaid}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

// ---------- fingerprint ----------

type RegistrationOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];

function Fingerprint({ customer, refresh, say }: { customer: CustomerView; refresh: () => void; say: (t: string) => void }) {
  const on = customer.fingerprint.length > 0;
  const [options, setOptions] = useState<{ value: RegistrationOptions; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  // Fetch the setup options ahead of time, so the tap goes straight to the fingerprint prompt.
  // (Safari only shows that prompt when it follows a tap directly.)
  const load = useCallback(async () => {
    try {
      const { options: value } = await api<{ options: RegistrationOptions }>("/api/wallet/fingerprint");
      setOptions({ value, at: Date.now() });
    } catch (e) {
      setError(errorText(e).message);
    }
  }, []);
  useEffect(() => {
    if (on || !supported) return;
    void load();
    const t = setInterval(() => void load(), 90_000);
    return () => clearInterval(t);
  }, [on, supported, load]);

  async function setUp() {
    if (!options) return;
    setError(null);
    const ask = startRegistration({ optionsJSON: options.value });
    say("Rest your finger on the Home button.");
    setBusy(true);
    try {
      const response = await ask;
      await api("/api/wallet/fingerprint", { method: "POST", body: { response } });
      say("Fingerprint is on. From now on, every payment needs your fingerprint.");
      refresh();
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Fingerprint not confirmed. Try again." : errorText(e).message);
      void load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="fp-h">
      <h2 id="fp-h">Fingerprint</h2>
      {on ? (
        <p>
          <strong>On.</strong> Every payment needs your fingerprint on this device, so nobody else can approve a payment by tapping the screen. Set up on{" "}
          {new Date(customer.fingerprint[0].createdAt).toLocaleDateString()}.
        </p>
      ) : !supported ? (
        <p>This browser cannot use a fingerprint. Payments are approved with a second tap.</p>
      ) : (
        <>
          <p>Use the fingerprint on this device to approve payments. Your fingerprint stays on the device; this app never sees it.</p>
          <button className="wide" disabled={!options || busy} onClick={() => void setUp()}>
            {busy ? "Waiting for your finger…" : options ? "Set up my fingerprint" : "Getting ready…"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="status bad">
          {error}
        </p>
      )}
    </section>
  );
}
