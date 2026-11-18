"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppBar, Avatar, Icon } from "@/components/ui";
import { api, errorText, type ApiError } from "@/lib/client";
import { formatAmount, speakAmount, type Amount } from "@/lib/money";
import { BrowserSpeechOutput, HostedSpeechOutput } from "@/lib/speech";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { inNativeApp, nativeCreateKey, nativeSign } from "@/lib/native";
import { canListen, recordAnswer } from "@/lib/listen";
import type { Intent } from "@/lib/voice/intent";
import { startLive, type LiveMode, type LiveSession } from "@/lib/liveVoice";

const HELP_TEXT = "You can ask: who is this, how much is left, or say again. To pay, say pay. To refuse, say no.";

/** English text of the app's answers, for the screen and as the fallback voice. Same records as the server's. */
function replyText(kind: "who" | "left", r: RequestView, cap: CapView | null): string {
  if (kind === "who") return r.knownPayee ? `This is ${r.merchantName}. You have paid them before.` : `This is ${r.merchantName}. You have never paid this person before.`;
  if (!cap || cap.status !== "active") return "You have no spending limit set, so your wallet will ask you on its own page.";
  const left = `${formatAmount(cap.left)} is left of your limit of ${formatAmount(cap.limit)}.`;
  if (!r.debitAmount) return left;
  const after = BigInt(cap.left.value) - BigInt(r.debitAmount.value);
  return after < BigInt(0)
    ? `${left} This payment is more than what is left, so your wallet will refuse it.`
    : `${left} If you pay, ${formatAmount({ ...cap.left, value: after.toString() })} will be left.`;
}

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
  fingerprint: { kind: "passkey" | "device"; id: string; transports?: string[]; createdAt: string }[];
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
const hosted = new HostedSpeechOutput(voice);

type Lang = "en" | "pcm" | "yo" | "ig" | "ha";
const LANG_NAMES: Record<Lang, string> = { en: "English", pcm: "Pidgin", yo: "Yoruba", ig: "Igbo", ha: "Hausa" };

/** How the app should speak: off, the device's English voice, or the natural hosted voice in a language. */
interface VoicePrefs {
  on: boolean;
  natural: boolean;
  /** After reading a request, listen for a spoken "pay" or "no". "pay" only opens the fingerprint prompt. */
  listen: boolean;
  lang: Lang;
}

function readPrefs(): VoicePrefs {
  try {
    const l = window.localStorage.getItem("lang") as Lang | null;
    return {
      on: window.localStorage.getItem("appVoice") !== "off",
      natural: window.localStorage.getItem("naturalVoice") !== "off",
      listen: window.localStorage.getItem("voiceAnswer") !== "off",
      lang: l && l in LANG_NAMES ? l : "en",
    };
  } catch {
    return { on: true, natural: true, listen: true, lang: "en" };
  }
}

function savePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the setting lasts for this visit only */
  }
}

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
  const [prefs, setPrefs] = useState<VoicePrefs>({ on: true, natural: true, listen: true, lang: "en" });
  const appVoice = prefs.on;
  const spokenFor = useRef<string>("");
  // While a live voice conversation is finishing (telling the result), keep its screen up even
  // though the request is no longer pending.
  const [held, setHeld] = useState<RequestView | null>(null);

  const say = useCallback(
    (text: string) => {
      if (appVoice && text) void voice.speak(text);
    },
    [appVoice],
  );

  /** One of the server's sentences in the chosen language; the English text is the fallback. */
  const sayOurs = useCallback(
    (params: Record<string, string>, fallbackText: string) => {
      if (!prefs.on) return;
      if (prefs.natural) hosted.play({ ...params, lang: prefs.lang }, fallbackText);
      else void voice.speak(fallbackText);
    },
    [prefs],
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
    setPrefs(readPrefs());
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
      if (inNativeApp() && prefs.on && prefs.listen && canListen()) return; // the approval screen asks by voice itself
      if (prefs.on && prefs.listen && canListen()) {
        sayOurs({ what: "asking", id: pending.id }, `${requestSentence(pending)} Tap the screen to talk about it.`);
        return;
      }
      say(`${requestSentence(pending)} Tap anywhere to hear this again.`);
    }
  }, [pending, say, sayOurs, prefs]);

  const finish = useCallback(
    async (r: RequestView, quiet = false) => {
      const s = await refresh();
      const text = resultSentence(r, s?.customer?.cap ?? null);
      setNotice({ text, good: r.status === "paid", walletSaid: r.failure?.walletSaid });
      if (quiet) return; // the live voice already told the customer
      if (r.status === "paid") sayOurs({ what: "result", id: r.id }, text);
      else say(text);
    },
    [refresh, say, sayOurs],
  );

  if (loadError && !state) {
    return (
      <>
        <AppBar role="Customer" />
        <main>
          <div className="status bad" role="alert">
            <p>{loadError.message}</p>
            <button onClick={() => void refresh()}>Try again</button>
          </div>
        </main>
      </>
    );
  }
  if (!state) {
    return (
      <>
        <AppBar role="Customer" />
        <main>
          <p role="status">Loading…</p>
        </main>
      </>
    );
  }
  if (!state.customer) return <Setup suggested={state.suggestedWalletAddress ?? ""} simulated={state.simulated} onDone={() => void refresh()} />;

  const shown = held ?? pending;
  if (shown)
    return (
      <Approve
        key={shown.id}
        request={shown}
        fingerprint={state.customer.fingerprint}
        cap={state.customer.cap}
        prefs={prefs}
        say={say}
        sayOurs={sayOurs}
        onDone={finish}
        hold={setHeld}
      />
    );

  return (
    <Home
      customer={state.customer}
      history={state.history ?? []}
      notice={notice}
      loadError={loadError}
      prefs={prefs}
      setPrefs={(next) => {
        setPrefs(next);
        savePref("appVoice", next.on ? "on" : "off");
        savePref("naturalVoice", next.natural ? "on" : "off");
        savePref("voiceAnswer", next.listen ? "on" : "off");
        savePref("lang", next.lang);
        if (!next.on) hosted.stop();
      }}
      sayOurs={sayOurs}
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
    <>
      <AppBar role="Customer" />
      <main>
        <h1>Set up this device</h1>
        <p className="lead">This is done once. Enter the wallet address you pay from.</p>
        <form onSubmit={submit} className="card" style={{ maxWidth: "40rem" }}>
          <label htmlFor="wa">Your wallet address</label>
          <input
            id="wa"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
          />
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
    </>
  );
}

// ---------- approving one request: the whole screen is one button ----------

function Approve({
  request,
  fingerprint,
  cap,
  prefs,
  say,
  sayOurs,
  onDone,
  hold,
}: {
  request: RequestView;
  fingerprint: CustomerView["fingerprint"];
  cap: CapView | null;
  prefs: VoicePrefs;
  say: (t: string) => void;
  sayOurs: (params: Record<string, string>, fallbackText: string) => void;
  onDone: (r: RequestView, quiet?: boolean) => void;
  hold: (r: RequestView | null) => void;
}) {
  const needsFinger = fingerprint.length > 0;
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hearing, setHearing] = useState<"" | "speaking" | "listening" | "thinking">("");
  const [talk, setTalk] = useState<{ who: "app" | "you"; text: string }[]>([]);
  const [message, setMessage] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const autoAsked = useRef(false);
  // Live conversation (ElevenLabs Agents). While it runs, the agent does the talking.
  const [live, setLive] = useState<LiveMode | "">("");
  const liveRef = useRef<LiveSession | null>(null);
  const liveOn = useRef(false);
  const liveResult = useRef<RequestView | null>(null);
  const toolWait = useRef<((s: string) => void) | null>(null);
  const toolText = useRef("");
  const armedRef = useRef(false);
  armedRef.current = armed;
  const ready = Boolean(request.challenge && request.debitAmount);
  const sentence = useMemo(() => requestSentence(request), [request]);
  const voiceAnswers = prefs.on && prefs.listen && canListen();
  const consentNote = request.needsWalletConsent
    ? " You have no spending limit yet, so your wallet will ask you to confirm this one payment on its own page."
    : "";

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // An armed approval goes back to sleep if nothing happens. Doing nothing never pays.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => {
      setArmed(false);
      settleTool("not paid: no tap or fingerprint came in time. Nothing was paid. The customer can say pay again.");
    }, 20000);
    return () => clearTimeout(t);
  }, [armed]);

  // End the live conversation if this screen goes away.
  useEffect(() => () => void liveRef.current?.end(), []);

  // Inside the iPad app the request is read out and the app listens without any tap at all.
  useEffect(() => {
    if (ready && voiceAnswers && inNativeApp() && !autoAsked.current) {
      autoAsked.current = true;
      void talk_();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, voiceAnswers]);

  function settleTool(text: string) {
    const w = toolWait.current;
    toolWait.current = null;
    w?.(text);
  }

  /** Finishes a payment or refusal. In a live conversation the agent tells the result first. */
  function done(r: RequestView) {
    if (!liveOn.current) return onDone(r);
    liveResult.current = r;
    const paid = r.status === "paid" && r.paid;
    toolText.current =
      paid
        ? `paid: ${speakAmount(r.paid!.debitAmount)} left the customer's account to ${r.merchantName}.`
        : r.status === "declined"
          ? "refused. No money moved."
          : `not paid: ${r.failure?.message ?? "the wallet did not pay"}. No money moved.`;
    settleTool(toolText.current);
    // If the agent does not end the call itself, close it after it has had time to speak.
    setTimeout(() => void liveRef.current?.end(), 15000);
  }

  /** The live conversation: natural voice, the customer can interrupt, the agent answers questions. */
  async function talk_(): Promise<void> {
    if (liveOn.current || busy || !ready) return;
    liveOn.current = true;
    hold(request);
    setMessage("Connecting the voice…");
    try {
      liveRef.current = await startLive({
        requestId: request.id,
        lang: prefs.lang,
        native: inNativeApp(),
        onMode: (m) => setLive(m),
        onLine: (who, text) => setTalk((t) => [...t, { who, text }]),
        onEnd: () => {
          liveOn.current = false;
          liveRef.current = null;
          setLive("");
          settleTool("not paid: the conversation ended.");
          const r = liveResult.current;
          hold(null);
          if (r) onDone(r, true);
          else setMessage("The conversation ended. Tap the screen to talk again.");
        },
        approve: async () => {
          toolText.current = "";
          const s = await activate(true);
          if (s === "done") return toolText.current || "not paid: the wallet did not answer.";
          if (s === "waiting") {
            setMessage(needsFinger ? "Tap the screen once, then rest your finger on the Home button." : "Tap the screen once to pay.");
            return new Promise<string>((res) => (toolWait.current = res));
          }
          return s;
        },
        refuse: async () => {
          const p = new Promise<string>((res) => (toolWait.current = res));
          void refuse();
          return p;
        },
      });
      setMessage("Talk naturally. Ask who is asking, how much is left, or say pay or no.");
    } catch (e) {
      console.error(e);
      liveOn.current = false;
      liveRef.current = null;
      setLive("");
      hold(null);
      // The live voice could not start: use the simpler voice answers instead.
      void askByVoice();
    }
  }

  /** Speaks one of the server's sentences in the chosen language (device English voice as fallback). */
  async function speak(params: Record<string, string>, fallbackText: string, shown: string) {
    setTalk((t) => [...t, { who: "app", text: shown }]);
    if (prefs.natural) await hosted.play({ ...params, id: request.id, lang: prefs.lang }, fallbackText);
    else await voice.speak(fallbackText);
  }

  /** Records one answer and asks the server what it was. */
  async function hear(): Promise<{ intent: Intent; heard: string }> {
    setHearing("listening");
    const wav = await recordAnswer();
    if (!wav) return { intent: "unclear", heard: "" };
    setHearing("thinking");
    const res = await fetch(`/api/voice/listen?lang=${prefs.lang}`, { method: "POST", body: wav, headers: { "content-type": "audio/wav" } });
    const data = (await res.json()) as { intent?: Intent; heard?: string };
    return { intent: data.intent ?? "unclear", heard: data.heard ?? "" };
  }

  /**
   * A short conversation about this request. The app reads it out, then keeps listening: questions
   * ("who is this?", "how much is left?", "say again", "help") get a spoken answer from our own records,
   * "no" refuses, and "pay" opens the fingerprint prompt. Voice never pays. It stops after two answers
   * it cannot understand, or after MAX_TURNS, and then waits for a tap.
   */
  async function askByVoice(): Promise<void> {
    if (busy || !ready || hearing) return;
    const MAX_TURNS = 8;
    const prompt = "To pay, say pay. To refuse, say no.";
    setMessage(`${sentence}${consentNote} ${prompt}`);
    setHearing("speaking");
    await speak({ what: "asking", answer: "1" }, `${sentence} ${prompt}`, `${sentence} ${prompt}`);
    let misses = 0;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let said: { intent: Intent; heard: string };
      try {
        said = await hear();
      } catch {
        setHearing("");
        const text = needsFinger
          ? "I could not use the microphone. Tap the screen, then rest your finger on the Home button to pay."
          : "I could not use the microphone. Tap the screen twice to pay.";
        setMessage(text);
        say(text);
        return;
      }
      if (said.heard) setTalk((t) => [...t, { who: "you", text: said.heard }]);
      setHearing("speaking");
      if (said.intent === "pay") {
        setHearing("");
        await activate(true);
        return;
      }
      if (said.intent === "refuse") {
        setHearing("");
        return refuse();
      }
      if (said.intent === "repeat") {
        misses = 0;
        await speak({ what: "asking", answer: "1" }, `${sentence} ${prompt}`, `${sentence} ${prompt}`);
        continue;
      }
      if (said.intent === "who" || said.intent === "left" || said.intent === "help") {
        misses = 0;
        const text = said.intent === "help" ? HELP_TEXT : `${replyText(said.intent, request, cap)} Say pay, or no.`;
        await speak({ what: "reply", kind: said.intent }, text, text);
        continue;
      }
      misses++;
      if (misses >= 2) break;
      await speak({ what: "reply", kind: "unclear" }, "Sorry, I did not catch that. Say pay, or no.", "Sorry, I did not catch that. Say pay, or no.");
    }
    setHearing("");
    const text = "I will stop listening now. Tap the screen to talk again.";
    setMessage(text);
    say(text);
  }

  /** spoken: the customer already heard the request and said "pay". */
  async function activate(spoken = false): Promise<string> {
    const quiet = liveOn.current; // the live agent does the talking
    if (busy || !ready) {
      if (!quiet) say(sentence);
      return "not paid: the request is not ready yet. Ask the customer to wait a moment.";
    }
    if (hearing) return "not paid: busy.";
    // A tap during a live conversation only matters once the agent has asked for the fingerprint.
    if (!spoken && quiet && !armedRef.current) return "";
    // First tap with voice answers on: start talking. A tap while armed goes straight on.
    if (!spoken && !armed && voiceAnswers) {
      if (prefs.natural) await talk_();
      else await askByVoice();
      return "";
    }
    let proof: { method: "confirm-button" | "passkey" | "device-key"; challenge?: string; response?: unknown; signature?: string } = {
      method: "confirm-button",
      challenge: request.challenge,
    };
    if (needsFinger) {
      // The fingerprint signs this request's challenge only, so it cannot pay anything else.
      const useNative = inNativeApp() && fingerprint.some((f) => f.kind === "device");
      const passkeys = fingerprint.filter((f) => f.kind === "passkey");
      if (!useNative && passkeys.length === 0) {
        const text = "Your fingerprint is set up in the Pay Alone app. Open the app on this iPad to approve.";
        setMessage(text);
        if (!quiet) say(text);
        return `not paid: ${text}`;
      }
      const ask = useNative
        ? nativeSign(request.challenge!, `Pay ${formatAmount(request.debitAmount!)} to ${request.merchantName}`)
        : startAuthentication({
            optionsJSON: {
              challenge: request.deviceChallenge!,
              rpId: window.location.hostname,
              allowCredentials: passkeys.map((f) => ({ id: f.id, type: "public-key" as const, transports: f.transports as AuthenticatorTransport[] | undefined })),
              userVerification: "required",
              timeout: 60000,
            },
          });
      setArmed(true);
      if (quiet) {
        // the agent already said what to do
      } else if (spoken) say("Rest your finger on the Home button to pay.");
      else sayOurs({ what: "asking", id: request.id }, `${sentence} To pay, rest your finger on the Home button.`);
      setMessage(`${spoken ? "" : `${sentence}${consentNote} `}To pay, rest your finger on the Home button. To refuse, do nothing.`);
      try {
        const result = await ask;
        proof = useNative
          ? { method: "device-key", challenge: request.challenge, signature: result as string }
          : { method: "passkey", challenge: request.challenge, response: result };
      } catch {
        // A website may not open the fingerprint prompt without a tap; the next tap goes straight to it.
        const text = spoken && !useNative
          ? "Tap the screen once, then rest your finger on the Home button to pay."
          : "Not paid. Your fingerprint was not confirmed. Tap the screen to try again.";
        setArmed(spoken && !useNative);
        setMessage(text);
        if (spoken && !useNative) return "waiting";
        if (quiet) settleTool("not paid: the fingerprint was not confirmed. Nothing was paid. The customer can say pay to try again.");
        if (!quiet) say(text);
        return "not paid: the fingerprint was not confirmed. Nothing was paid. The customer can say pay to try again.";
      }
    } else if (!armed) {
      // No fingerprint: a voice "pay" or a first tap only arms; a physical tap pays.
      setArmed(true);
      if (spoken) {
        setMessage("Tap the screen to pay. To refuse, do nothing.");
        if (!quiet) say("Tap the screen to pay.");
        return "waiting";
      }
      sayOurs({ what: "asking", id: request.id }, sentence);
      setMessage(`${sentence}${consentNote} Tap again to pay. To refuse, do nothing.`);
      setTimeout(() => say("Tap again to pay."), 9000);
      return "";
    }
    setBusy(true);
    setArmed(false);
    setMessage("Paying. Please wait.");
    if (!quiet) say("Paying. Please wait.");
    try {
      const res = await api<{ request: RequestView; redirectUrl?: string }>(`/api/wallet/requests/${request.id}/approve`, { method: "POST", body: { proof } });
      if (res.redirectUrl) {
        setMessage("Opening your wallet's page to confirm this payment.");
        settleTool("not paid yet: there is no spending limit, so the wallet is opening its own page to confirm this one payment.");
        void liveRef.current?.end();
        setTimeout(() => window.location.assign(res.redirectUrl!), 300);
        return "redirect";
      }
      done(res.request);
    } catch (e) {
      const err = errorText(e);
      done({ ...request, status: "failed", failure: { kind: err.kind, message: err.message, walletSaid: err.walletSaid } });
    }
    return "done";
  }

  async function refuse() {
    setBusy(true);
    try {
      const res = await api<{ request: RequestView }>(`/api/wallet/requests/${request.id}/decline`, { method: "POST" });
      done(res.request);
    } catch (e) {
      const err = errorText(e);
      done({ ...request, status: "failed", failure: { kind: err.kind, message: err.message } });
    }
  }

  const instruction = !ready
    ? "Getting the exact amount from your wallet…"
    : busy
      ? "Paying. Please wait."
      : live && armed
        ? needsFinger
          ? "Tap once, then rest your finger on the Home button."
          : "Tap the screen to pay."
        : live === "connecting"
          ? "Connecting the voice…"
          : live === "speaking"
            ? "Speaking… you can interrupt any time."
            : live === "listening"
              ? "Listening… talk naturally."
              : hearing === "speaking"
        ? "Reading the request…"
        : hearing === "listening"
          ? "Listening. Say “pay” or “no”, or ask “who is this?”"
          : hearing === "thinking"
            ? "Checking what you said…"
            : armed
              ? needsFinger
                ? "Rest your finger on the Home button to pay."
                : "Tap again to pay. To refuse, do nothing."
              : voiceAnswers
                ? "Tap anywhere to talk about this request."
                : needsFinger
                  ? "Tap anywhere, then rest your finger on the Home button."
                  : "Tap anywhere to hear this request.";

  const icon = hearing === "listening" ? "mic" : armed && needsFinger ? "finger" : armed ? "check" : "speaker";

  return (
    <div className="takeover" role="dialog" aria-modal="true" aria-label="Payment request">
      <button
        ref={buttonRef}
        className={`approve ${armed || hearing === "listening" ? "armed" : ""}`}
        onClick={() => void activate()}
        disabled={busy}
        aria-describedby="approve-how"
      >
        {live ? <VoiceOrb session={liveRef} mode={live} /> : <Avatar name={request.merchantName} />}
        {!request.knownPayee && <span className="new-tag">New person</span>}
        <span className="who">{request.merchantName} is asking for</span>
        <span className="amount">{formatAmount(request.receiveAmount ?? request.requested)}</span>
        {request.debitAmount && <span className="debit">{formatAmount(request.debitAmount)} will leave your account</span>}
        <span className="how" id="approve-how">
          <Icon name={icon} size={26} />
          {instruction}
        </span>
      </button>
      <div className="sr-only" role="status" aria-live="assertive">
        {message}
      </div>
      {talk.length > 0 && (
        <ol className="talk" aria-label="Conversation">
          {talk.slice(-6).map((t, i) => (
            <li key={i} className={t.who}>
              <span className="sr-only">{t.who === "you" ? "You said: " : "Pay Alone said: "}</span>
              {t.text}
            </li>
          ))}
        </ol>
      )}
      <button className="refuse" onClick={() => void refuse()} disabled={busy}>
        Refuse this request
      </button>
    </div>
  );
}

/**
 * A glowing orb that moves with the voices: it swells with the customer's voice (green) while the app
 * listens and with the agent's voice (blue) while it speaks. Decorative; the words are on screen too.
 */
function VoiceOrb({ session, mode }: { session: React.RefObject<LiveSession | null>; mode: LiveMode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    let smooth = 0;
    const tick = () => {
      const l = session.current?.levels() ?? { input: 0, output: 0 };
      const level = mode === "speaking" ? l.output : mode === "listening" ? l.input : 0;
      smooth = smooth * 0.75 + Math.min(1, level * 2.2) * 0.25;
      ref.current?.style.setProperty("--level", smooth.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session, mode]);
  return (
    <span className={`orb ${mode}`} ref={ref} aria-hidden="true">
      <span className="orb-ring" />
      <span className="orb-ring two" />
      <span className="orb-core" />
    </span>
  );
}

// ---------- home ----------

function Home(props: {
  customer: CustomerView;
  history: HistoryItem[];
  notice: { text: string; good: boolean; walletSaid?: string } | null;
  loadError: ApiError | null;
  prefs: VoicePrefs;
  setPrefs: (p: VoicePrefs) => void;
  sayOurs: (params: Record<string, string>, fallbackText: string) => void;
  say: (t: string) => void;
  refresh: () => void;
  setNotice: (n: { text: string; good: boolean; walletSaid?: string } | null) => void;
}) {
  const { customer, notice, say } = props;
  const cap = customer.cap;
  const digits = customer.payCode.split("").join(" ");

  return (
    <>
      <AppBar role="Customer" />
      <main>
        <h1>Hello{customer.name ? `, ${customer.name}` : ""}</h1>
        <p className="muted">
          Paying from {customer.walletAddress} in {customer.assetCode}.
        </p>

        {notice && (
          <div className={`status ${notice.good ? "good" : "bad"}`} role="status" aria-live="polite">
            <span className="status-icon">
              <Icon name={notice.good ? "check" : "cross"} size={18} />
            </span>
            <div>
              <p>{notice.text}</p>
              {notice.walletSaid && <p className="muted">The wallet said: {notice.walletSaid}</p>}
            </div>
          </div>
        )}
        {props.loadError && <p role="alert">Cannot check for new requests: {props.loadError.message} Still trying.</p>}

        <section className="card" aria-labelledby="code-h">
          <div className="paycode">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qr" src="/api/wallet/paycode" alt={`QR code for pay code ${digits}`} />
            <div>
              <h2 id="code-h">Your pay code</h2>
              <p className="code" aria-label={`Pay code ${digits}`}>
                {customer.payCode}
              </p>
              <p className="muted">Show it to a seller so they can ask you for a payment. It cannot take money. Only your fingerprint can.</p>
              <button className="wide secondary" onClick={() => say(`Your pay code is ${digits}. Again: ${digits}.`)}>
                <Icon name="speaker" size={22} /> Say my pay code aloud
              </button>
              <LockScreenPicture payCode={customer.payCode} />
            </div>
          </div>
        </section>

        <div className="grid-2">
          <Limit cap={cap} customer={customer} refresh={props.refresh} say={say} sayOurs={props.sayOurs} setNotice={props.setNotice} />
          <Fingerprint customer={customer} refresh={props.refresh} say={say} />
        </div>

        <History items={props.history} say={say} />

        <details className="card">
          <summary>
            <span className="card-icon">
              <Icon name="gear" size={22} />
            </span>
            Voice and settings
          </summary>
          <label className="toggle">
            <input type="checkbox" checked={props.prefs.on} onChange={(e) => props.setPrefs({ ...props.prefs, on: e.target.checked })} />
            <span>The app speaks aloud. Turn this off if you use VoiceOver or TalkBack, which already read the screen.</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={props.prefs.natural}
              disabled={!props.prefs.on}
              onChange={(e) => props.setPrefs({ ...props.prefs, natural: e.target.checked })}
            />
            <span>
              Natural voice for requests and results (ElevenLabs, or Spitch for Igbo). Needs internet; if it is slow, the device&apos;s own English voice is
              used.
            </span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={props.prefs.listen}
              disabled={!props.prefs.on}
              onChange={(e) => props.setPrefs({ ...props.prefs, listen: e.target.checked })}
            />
            <span>
              Answer by voice. After a request is read out, say &quot;pay&quot; or &quot;no&quot; in your language. Saying pay only asks for your fingerprint;
              your voice never moves money. Uses the microphone for a few seconds; the recording is not kept.
            </span>
          </label>
          <label htmlFor="lang">Language for requests and results</label>
          <select
            id="lang"
            value={props.prefs.lang}
            disabled={!props.prefs.on || !props.prefs.natural}
            onChange={(e) => props.setPrefs({ ...props.prefs, lang: e.target.value as Lang })}
          >
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
          <p className="muted">
            Amounts are always said in English, as most people say them. The Pidgin, Yoruba, Igbo and Hausa sentences have not yet been checked by a native
            speaker. Instructions are in English for now.
          </p>
          <button
            className="secondary"
            onClick={async () => {
              await api("/api/wallet/setup", { method: "DELETE" });
              props.refresh();
            }}
          >
            Forget this device
          </button>
        </details>
      </main>
    </>
  );
}

function Limit({
  cap,
  customer,
  refresh,
  say,
  sayOurs,
  setNotice,
}: {
  cap: CapView | null;
  customer: CustomerView;
  refresh: () => void;
  say: (t: string) => void;
  sayOurs: (params: Record<string, string>, fallbackText: string) => void;
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
      <div className="card-head">
        <span className="card-icon">
          <Icon name="shield" size={22} />
        </span>
        <h2 id="limit-h">Spending limit</h2>
      </div>
      {cap?.status === "active" ? (
        <>
          <p className="muted">Left this {cap.every}</p>
          <p className="amount">{formatAmount(cap.left)}</p>
          <Meter spent={cap.spent} limit={cap.limit} />
          <p>
            Up to <strong>{formatAmount(cap.limit)}</strong> every {cap.every}. Your wallet enforces this, not this app.
          </p>
          <p className="muted">
            Counts payments through this app since {new Date(cap.grantedAt).toLocaleDateString()}. This is your limit, not your account balance: Open Payments does not let an app
            read a balance.
          </p>
          <button
            className="wide secondary"
            onClick={() => sayOurs({ what: "left" }, `${speakAmount(cap.left)} is left of your limit of ${speakAmount(cap.limit)} for this ${cap.every}.`)}
          >
            <Icon name="speaker" size={22} /> Say what is left aloud
          </button>
          <button className="wide danger" disabled={busy} onClick={() => void stop()}>
            <Icon name="stop" size={22} /> {confirmStop ? "Tap again to stop everything" : "Stop everything"}
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
          <input
            id="cap-amount"
            inputMode="decimal"
            autoComplete="off"
            required
            placeholder={customer.assetCode === "NGN" ? "20000" : "50"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
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

function Meter({ spent, limit }: { spent: Amount; limit: Amount }) {
  // Display only: the percentage is for the bar's width, never for money decisions.
  const pct = BigInt(limit.value) > BigInt(0) ? Number((BigInt(spent.value) * BigInt(100)) / BigInt(limit.value)) : 0;
  const width = Math.min(100, Math.max(0, pct));
  return (
    <>
      <div className={`meter ${width >= 80 ? "high" : ""}`} role="img" aria-label={`${formatAmount(spent)} spent of ${formatAmount(limit)}`}>
        <span style={{ width: `${width}%` }} />
      </div>
      <div className="meter-legend" aria-hidden="true">
        <span>{formatAmount(spent)} spent</span>
        <span>{formatAmount(limit)}</span>
      </div>
    </>
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
        Make a lock-screen picture
      </button>
      {problem && <p role="alert">{problem}</p>}
    </>
  );
}

// ---------- history ----------

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

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
      return {
        title: `Not paid: ${h.merchantName} asked for ${formatAmount(h.receiveAmount ?? h.requested)}`,
        detail: h.failure?.message ?? "Refused.",
        good: false,
      };
    case "expired":
      return {
        title: `Not paid: ${h.merchantName} asked for ${formatAmount(h.receiveAmount ?? h.requested)}`,
        detail: "The request ran out of time.",
        good: false,
      };
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
  if (h.status === "failed" && h.failure?.kind === "limit_exceeded")
    return `${day}: ${h.merchantName} asked for ${speakAmount(amount)}. Your wallet refused it. Over your limit.`;
  return `${day}: ${h.merchantName} asked for ${speakAmount(h.receiveAmount ?? h.requested)}. Not paid.`;
}

function History({ items, say }: { items: HistoryItem[]; say: (t: string) => void }) {
  return (
    <section className="card" aria-labelledby="hist-h">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="list" size={22} />
        </span>
        <h2 id="hist-h">Your payments</h2>
      </div>
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
            <Icon name="speaker" size={22} /> Say my last payments aloud
          </button>
          <ol className="history">
            {items.map((h) => {
              const line = historyLine(h);
              return (
                <li key={h.id} className={line.good ? "good" : "bad"}>
                  <span className="mark" aria-hidden="true">
                    <Icon name={line.good ? "check" : "cross"} size={18} />
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
  const native = typeof window !== "undefined" && inNativeApp();
  const supported = native || (typeof window !== "undefined" && "PublicKeyCredential" in window);

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
    if (on || !supported || native) return;
    void load();
    const t = setInterval(() => void load(), 90_000);
    return () => clearInterval(t);
  }, [on, supported, native, load]);

  async function setUpNative() {
    // Native iPad app: a Secure Enclave key that only works after Touch ID. Signing the setup
    // challenge shows the Touch ID prompt once and proves the key works before it is saved.
    setError(null);
    setBusy(true);
    say("Rest your finger on the Home button.");
    try {
      const { challenge } = await api<{ challenge: string }>("/api/wallet/devicekey");
      const publicKey = await nativeCreateKey();
      const signature = await nativeSign(challenge, "Turn on fingerprint approval for Pay Alone");
      await api("/api/wallet/devicekey", { method: "POST", body: { publicKey, signature } });
      say("Fingerprint is on. From now on, every payment needs your fingerprint.");
      refresh();
    } catch (e) {
      setError(e instanceof Error && !(e as { error?: unknown }).error ? "Fingerprint not confirmed. Try again." : errorText(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function setUp() {
    if (native) return setUpNative();
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
      <div className="card-head">
        <span className="card-icon">
          <Icon name="finger" size={22} />
        </span>
        <h2 id="fp-h">Fingerprint</h2>
      </div>
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
          <button className="wide" disabled={(!native && !options) || busy} onClick={() => void setUp()}>
            <Icon name="finger" size={22} /> {busy ? "Waiting for your finger…" : native || options ? "Set up my fingerprint" : "Getting ready…"}
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
