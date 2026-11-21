"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppBar, Icon } from "@/components/ui";
import { api, errorText, type ApiError } from "@/lib/client";
import { formatAmount, nairaOf, speakAmount, type Amount } from "@/lib/money";
import { BrowserSpeechOutput, HostedSpeechOutput } from "@/lib/speech";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { inNativeApp, nativeCreateKey, nativeSign } from "@/lib/native";
import { canListen, recordAnswer } from "@/lib/listen";
import type { Intent } from "@/lib/voice/intent";
import { LIVE_KEY, stageBrief, stageOpen, stageSend, stageStatus } from "@/lib/stage";
import { nudgeAudio, report, stageMode, startLive, successChime, type LiveMode, type LiveSession } from "@/lib/liveVoice";
import { GlassOrb } from "@/components/GlassOrb";
import { canWake, startWake } from "@/lib/wake";
import { createAvatar } from "@dicebear/core";
import * as openPeeps from "@dicebear/open-peeps";
import "./dashboard.css";

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

const SYMBOL: Record<string, string> = { USD: "$", NGN: "₦", EUR: "€", GBP: "£", ZAR: "R", KES: "KSh" };
const symbolOf = (code: string) => SYMBOL[code] ?? code;
const titleCase = (n: string) => n.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** An amount with a small raised currency sign. Screen readers hear it spoken in full. */
function Money({ a, size = "md" }: { a: Amount; size?: "sm" | "md" | "lg" | "xl" }) {
  const num = formatAmount(a).slice(a.assetCode.length + 1);
  return (
    <span className={`money ${size}`}>
      <span className="sr-only">{speakAmount(a)}</span>
      <span aria-hidden="true">
        <sup>{symbolOf(a.assetCode)}</sup>
        {num}
      </span>
      {nairaOf(a) && (
        <span aria-hidden="true" style={{ display: "block", fontSize: "0.42em", opacity: 0.75, fontWeight: 500, letterSpacing: 0 }}>
          ≈ ₦{nairaOf(a)}
        </span>
      )}
    </span>
  );
}

/** Hand-drawn person (Open Peeps). The look is picked from the name, so it stays the same each time. */
const LOOKS = [
  { head: "bantuKnots", face: "smileBig", skin: "ae5d29", bg: "c3e88f" },
  { head: "short2", face: "calm", skin: "694d3d", bg: "bfe6f5", beard: true },
  { head: "twists", face: "lovingGrin1", skin: "d08b5b", bg: "f3dfe9" },
  { head: "afro", face: "smile", skin: "694d3d", bg: "e4e1fb" },
  { head: "hijab", face: "cute", skin: "ae5d29", bg: "fde7c8" },
  { head: "dreads1", face: "smileTeethGap", skin: "d08b5b", bg: "d7f0e6" },
];
const SELF_LOOK = { head: "grayBun", face: "smile", skin: "694d3d", bg: "ffffff" };
function lookFor(name: string) {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LOOKS[h % LOOKS.length]!;
}
function Peep({ name, size = 44, bg, self = false }: { name: string; size?: number; bg?: string; self?: boolean }) {
  const src = useMemo(() => {
    const l = self ? SELF_LOOK : lookFor(name);
    return createAvatar(openPeeps, {
      seed: name,
      backgroundColor: [bg ?? l.bg],
      radius: 50,
      scale: 110,
      head: [l.head],
      face: [l.face],
      skinColor: [l.skin],
      accessoriesProbability: 0,
      maskProbability: 0,
      facialHairProbability: "beard" in l && l.beard ? 100 : 0,
    } as Parameters<typeof createAvatar>[1]).toDataUri();
  }, [name, bg, self]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} className="peep" />;
}

/** This week's payments by day (Monday first), from our own records. Heights only; money stays in minor units. */
function weekSummary(items: HistoryItem[]) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = labels.map(() => BigInt(0));
  let paid = 0;
  let refused = 0;
  for (const h of items) {
    const at = new Date(h.at);
    if (at < monday) continue;
    if (h.status === "paid") {
      paid++;
      values[(at.getDay() + 6) % 7] += BigInt((h.debitAmount ?? h.requested).value);
    } else if (h.status === "declined" || h.status === "expired" || h.status === "failed") refused++;
  }
  const total = values.reduce((a, b) => a + b, BigInt(0));
  const max = Math.max(1, ...values.map(Number));
  const todayIdx = (now.getDay() + 6) % 7;
  return { days: labels.map((label, i) => ({ label, value: Number(values[i]), today: i === todayIdx })), max, paid, refused, total: total.toString() };
}

/** People in this customer's history: paid ones first, by how often. */
function peopleOf(items: HistoryItem[]) {
  const m = new Map<string, { name: string; paid: number; last: string }>();
  for (const h of items) {
    const p = m.get(h.merchantName) ?? { name: h.merchantName, paid: 0, last: h.at };
    if (h.status === "paid") p.paid++;
    if (h.at > p.last) p.last = h.at;
    m.set(h.merchantName, p);
  }
  return [...m.values()].sort((a, b) => b.paid - a.paid || b.last.localeCompare(a.last));
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
  /** Worked out by Pay Alone: a figure read from the wallet, minus payments made through Pay Alone since. */
  balance?: { amount: Amount; asOf: string; source: string; paidSince: Amount; count: number } | null;
}

interface RequestView {
  id: string;
  status: "waiting" | "quoted" | "consent" | "paying" | "paid" | "declined" | "expired" | "failed";
  merchantName: string;
  knownPayee: boolean;
  /** The customer asked to send this by voice; no seller asked. */
  outgoing?: boolean;
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

/** The one live voice conversation (ElevenLabs agent), shared by the home screen and the payment screen. */
interface Live {
  mode: LiveMode | "";
  /** The mode right now (for code that runs later than the render it was made in). */
  modeNow: () => LiveMode | "";
  lines: { who: "app" | "you"; text: string }[];
  session: React.RefObject<LiveSession | null>;
  active: React.RefObject<boolean>;
  /** Set by the payment screen while it is shown, so the agent can pay or refuse the waiting payment. */
  handlers: React.RefObject<{ approve?: () => Promise<string>; refuse?: () => Promise<string>; ended?: () => void }>;
  start: (requestId?: string) => Promise<boolean>;
  end: () => void;
  /** Between conversations: free listening for a greeting ("hello", "Pay Alone"), which starts a new one. */
  standby: boolean;
  /** After a payment: what is left of the limit, from fresh records, as a sentence for the agent. */
  leftNow: () => Promise<string>;
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
  /** Start the live conversation as soon as the wallet opens, with no tap. */
  auto: boolean;
  lang: Lang;
}

function readPrefs(): VoicePrefs {
  try {
    const l = window.localStorage.getItem("lang") as Lang | null;
    return {
      on: window.localStorage.getItem("appVoice") !== "off",
      natural: window.localStorage.getItem("naturalVoice") !== "off",
      listen: window.localStorage.getItem("voiceAnswer") !== "off",
      auto: window.localStorage.getItem("autoTalk") !== "off",
      lang: l && l in LANG_NAMES ? l : "en",
    };
  } catch {
    return { on: true, natural: true, listen: true, auto: true, lang: "en" };
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
  if (r.outgoing)
    return r.debitAmount && r.receiveAmount
      ? `You are sending ${speakAmount(r.receiveAmount)} to ${r.merchantName}. ${speakAmount(r.debitAmount)} will leave your account.`
      : `You are sending ${speakAmount(r.requested)} to ${r.merchantName}. Getting the exact amount from your wallet.`;
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

/** Whether this device's browser opens the fingerprint prompt without a tap ("ok"), needs one ("tap"), or is unknown (""). */
function fingerNoTap(): "" | "ok" | "tap" {
  try {
    const v = localStorage.getItem("payalone-finger-notap");
    return v === "ok" || v === "tap" ? v : "";
  } catch {
    return "";
  }
}
function rememberFingerNoTap(v: "ok" | "tap") {
  try {
    localStorage.setItem("payalone-finger-notap", v);
  } catch {
    // private mode: try again next time
  }
}

export default function WalletPage() {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<{ text: string; good: boolean; walletSaid?: string } | null>(null);
  const [prefs, setPrefs] = useState<VoicePrefs>({ on: true, natural: true, listen: true, auto: true, lang: "en" });
  const appVoice = prefs.on;
  const spokenFor = useRef<string>("");
  // The one live voice conversation.
  const [liveMode, setLiveModeState] = useState<LiveMode | "">("");
  const liveModeRef = useRef<LiveMode | "">("");
  const setLiveMode = useCallback((m: LiveMode | "") => {
    liveModeRef.current = m;
    setLiveModeState(m);
  }, []);
  const [standby, setStandby] = useState(false);
  const [liveLines, setLiveLines] = useState<{ who: "app" | "you"; text: string }[]>([]);
  const liveSession = useRef<LiveSession | null>(null);
  const liveActive = useRef(false);
  const liveHandlers = useRef<{ approve?: () => Promise<string>; refuse?: () => Promise<string>; ended?: () => void }>({});
  const liveFor = useRef<string>(""); // the request the conversation was started about, or "" for none
  const sentByVoice = useRef<string>("");

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

  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    setPrefs(readPrefs());
    setPrefsLoaded(true);
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

  // Lock-screen alerts: the service worker shows them; when one is opened, check for the request at once.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "check-requests") void refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [refresh]);

  // Poll for new requests. The Open Payments API has no push to clients, so the app asks.
  useEffect(() => {
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]);

  /** Why there is nothing to pay, from the latest finished request (for example it timed out). */
  const lastRef = useRef<RequestView | null>(null);
  useEffect(() => {
    lastRef.current = state?.last ?? null;
  }, [state?.last]);
  const nothingWaiting = () => {
    const l = lastRef.current;
    if (l?.status === "expired")
      return `not paid: no payment is waiting. The request from ${l.merchantName} timed out after 10 minutes without an answer, so nothing was paid. ${l.merchantName} can send it again.`;
    return "not paid: no payment is waiting right now. Nothing was paid.";
  };

  // Starts a payment the customer asked for by voice and waits for the wallet's quote. Never pays.
  const prepared = useCallback(
    async (start: () => Promise<{ id: string; to: string; naira?: string }>): Promise<string> => {
      try {
        // A brief drop in the iPad's connection should not lose the request: try up to three times.
        // Safe to repeat: if an earlier try did reach the server, the repeat is refused as "already waiting".
        let res: { id: string; to: string; naira?: string } | null = null;
        for (let attempt = 0; !res; attempt++) {
          try {
            res = await start();
          } catch (e) {
            // An earlier try did get through: the waiting payment is the one just asked for.
            if (attempt > 0 && /already waiting/.test(errorText(e).message)) {
              const p = (await refresh())?.pending;
              if (p?.outgoing) {
                res = { id: p.id, to: p.merchantName };
                break;
              }
            }
            if (errorText(e).kind !== "offline" || attempt >= 2) throw e;
            await new Promise((w) => setTimeout(w, 1200 * (attempt + 1)));
          }
        }
        const said = res.naira ? `The customer asked for ${res.naira} naira; the test wallet runs in dollars, so it is sent as its dollar value at the CBN rate. Say it as ${res.naira} naira, and also give the dollar amount. ` : "";
        sentByVoice.current = res.id;
        liveFor.current = res.id;
        for (let i = 0; i < 25; i++) {
          const st = await refresh();
          const r = st?.pending;
          if (r && r.id === res.id && r.debitAmount && r.receiveAmount) {
            const consent = r.needsWalletConsent ? " There is no spending limit, so after the fingerprint the wallet will open its own page to confirm." : "";
            return `${said}ready, not paid yet: ${r.merchantName} will receive ${speakAmount(r.receiveAmount)}. ${speakAmount(r.debitAmount)} will leave the customer's account, fees included.${consent} Ask the customer if they want to pay.`;
          }
          if (!r || r.id !== res.id) {
            if (st?.last?.id === res.id) return `could not prepare: ${st.last.failure?.message ?? "the wallet did not accept it"}. Nothing was paid.`;
          }
          await new Promise((w) => setTimeout(w, 1000));
        }
        return "not ready: the wallet did not give the exact amount in time. Nothing was paid.";
      } catch (e) {
        const msg = errorText(e).message;
        if (/already waiting/.test(msg))
          return `not started: ${msg} Nothing was cancelled and nothing was paid. Tell the customer exactly which payment is waiting (who and how much) and ask: pay it, or cancel it? To pay it, follow step 3 and call approve_payment. To cancel it, call refuse_payment; then, if they still want the new one, call this tool again.`;
        return `could not prepare: ${msg} Nothing was paid.`;
      }
    },
    [refresh],
  );

  // One fingerprint approval at a time, started by the agent's tool or by the safety net.
  const approving = useRef(false);
  const runApprove = useCallback(async (): Promise<string> => {
    if (approving.current) return "not paid: the fingerprint prompt is already open. Wait for the customer's finger.";
    approving.current = true;
    try {
      const r = await (liveHandlers.current.approve?.() ?? Promise.resolve(nothingWaiting()));
      // The result is also sent as a context update: if the customer spoke while the fingerprint was
      // being asked for, the voice service can drop the tool result with that turn.
      liveSession.current?.context(
        r.startsWith("paid")
          ? `RESULT: the payment is finished and PAID. ${r} Do not ask for a tap or the fingerprint again. Tell the customer plainly that it is paid.`
          : `RESULT of the fingerprint step: ${r}`,
      );
      // The Touch ID sheet can leave the microphone paused on iPad: reopen it.
      setTimeout(() => void liveSession.current?.refreshAudio("after fingerprint"), 400);
      return r;
    } finally {
      approving.current = false;
    }
  }, []);

  const startLiveVoice = useCallback(
    async (requestId?: string): Promise<boolean> => {
      if (liveActive.current) return true;
      liveActive.current = true;
      liveFor.current = requestId ?? "";
      setLiveLines([]);
      const startedAt = Date.now();
      let heardLines = 0;
      try {
        liveSession.current = await startLive({
          startUrl: `/api/voice/agent?native=${inNativeApp() ? "1" : "0"}&tap=${fingerNoTap() === "tap" ? "1" : "0"}${requestId ? `&id=${encodeURIComponent(requestId)}` : ""}`,
          lang: prefs.lang,
          onMode: setLiveMode,
          onLine: (who, text) => {
            heardLines++;
            setLiveLines((l) => [...l, { who, text }]);
            // Safety net: the agent told the customer to use their finger but did not open the prompt.
            if (who === "app" && /rest your finger|home button/i.test(text)) {
              setTimeout(() => {
                if (!approving.current && liveHandlers.current.approve) {
                  report("agent asked for the finger without approve_payment; opening it");
                  void runApprove();
                }
              }, 1500);
            }
          },
          onEnd: () => {
            liveActive.current = false;
            liveSession.current = null;
            setLiveMode("");
            liveHandlers.current.ended?.();
            // Ended at once without a word: the voice service refused (for example, out of minutes). Say so aloud.
            if (Date.now() - startedAt < 6000 && heardLines === 0) {
              report("live voice ended at once", "no lines");
              void voice.speak("Sorry, the Pay Alone voice is not available right now. You can still pay by tapping the screen.");
            }
          },
          tools: {
            show_pay_code: async () => {
              window.dispatchEvent(new Event("payalone:show-code"));
              const code = (await refresh())?.customer?.payCode ?? "";
              return code ? `shown: the QR code and the pay code ${code.split("").join(" ")} are now large on the screen.` : "could not show the pay code.";
            },
            // The result is also sent as a context update: if the customer spoke while the fingerprint was
            // being asked for, the voice service can drop the tool result with that turn, and the agent
            // would keep asking for a finger that was already given.
            approve_payment: () => runApprove(),
            // A new spending limit: only the wallet can grant it, on its own page, where the customer accepts.
            change_limit: async (p) => {
              try {
                const every = String(p.every ?? "week").toLowerCase().startsWith("d") ? "day" : "week";
                const r = await api<{ redirectUrl: string; limit: Amount }>("/api/wallet/cap", { method: "POST", body: { amount: String(p.amount ?? ""), every } });
                setTimeout(() => {
                  liveSession.current?.end();
                  window.location.assign(r.redirectUrl);
                }, 9000);
                return `opening: in about 9 seconds the wallet's own page opens to confirm a new limit of ${speakAmount(r.limit)} a ${every}. Tell the customer now, in two short sentences: their wallet's page is opening, and they must accept the new limit there themselves; then they come back to Pay Alone. Until they accept, the old limit stays. This call will end when the page opens.`;
              } catch (e) {
                return `could not start: ${errorText(e).message} The limit did not change.`;
              }
            },
            refuse_payment: () => liveHandlers.current.refuse?.() ?? Promise.resolve("nothing to refuse: no payment is waiting right now."),
            send_money: async (p) => prepared(() => api<{ id: string; to: string }>("/api/wallet/send", { method: "POST", body: { to: String(p.to ?? ""), amount: String(p.amount ?? "") } })),
            save_money: async (p) =>
              prepared(() => api<{ id: string; to: string }>("/api/wallet/grow", { method: "POST", body: { action: "save", amount: String(p.amount ?? "") } })),
            invest_practice: async (p) =>
              prepared(() =>
                api<{ id: string; to: string }>("/api/wallet/grow", { method: "POST", body: { action: "invest", share: String(p.share ?? ""), amount: String(p.amount ?? "") } }),
              ),
            market_overview: async () => {
              try {
                const g = await api<GrowView>("/api/wallet/grow");
                window.dispatchEvent(new Event("payalone:show-grow"));
                return `live prices (facts, not advice): ${marketLine(g.market)}. ${growLine(g)}`;
              } catch (e) {
                return `prices not available: ${errorText(e).message}`;
              }
            },
            my_savings_and_investments: async () => {
              try {
                const g = await api<GrowView>("/api/wallet/grow");
                window.dispatchEvent(new Event("payalone:show-grow"));
                return growLine(g);
              } catch (e) {
                return `not available: ${errorText(e).message}`;
              }
            },
          },
        });
        return true;
      } catch (e) {
        console.error(e);
        liveActive.current = false;
        liveSession.current = null;
        setLiveMode("");
        return false;
      }
    },
    [prefs.lang, refresh, setLiveMode, prepared, runApprove],
  );

  const live: Live = {
    mode: liveMode,
    modeNow: () => liveModeRef.current,
    lines: liveLines,
    session: liveSession,
    active: liveActive,
    handlers: liveHandlers,
    start: startLiveVoice,
    end: () => void liveSession.current?.end(),
    standby,
    leftNow: async () => {
      const st = await refresh();
      const c = st?.customer?.cap;
      return c && c.status === "active" ? ` Left of the limit now: ${speakAmount(c.left)} of ${speakAmount(c.limit)}.` : "";
    },
  };

  // Open the app, and Pay Alone starts talking: no tap needed. About the waiting request if there is one.
  // Each opening counts once; leaving the app ends the call (it would keep using voice minutes).
  const [needTap, setNeedTap] = useState(false);
  const autoDone = useRef(false);
  const autoOk = Boolean(prefsLoaded && prefs.on && prefs.natural && prefs.auto && state?.customer);
  const autoPending = state?.pending ?? null;
  const autoWaitQuote = Boolean(autoPending && !autoPending.debitAmount);
  useEffect(() => {
    if (!autoOk || autoDone.current || liveActive.current || autoWaitQuote) return;
    autoDone.current = true;
    if (autoPending) spokenFor.current = autoPending.id; // the agent reads it; do not also play the recorded sentence
    void startLiveVoice(autoPending?.id).then((ok) => setNeedTap(!ok));
  }, [autoOk, autoWaitQuote, autoPending, startLiveVoice]);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        liveSession.current?.end();
        autoDone.current = false; // next time the app is opened, talk again
      } else void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);
  // A microphone that went dead (exactly zero for several seconds while listening) is reopened.
  useEffect(() => {
    if (liveMode !== "listening") return;
    let zeroFor = 0;
    let lastFix = 0;
    const t = setInterval(() => {
      const v = liveSession.current?.levels().input ?? 1;
      zeroFor = v === 0 ? zeroFor + 500 : 0;
      if (zeroFor >= 6000 && Date.now() - lastFix > 15000) {
        lastFix = Date.now();
        zeroFor = 0;
        void liveSession.current?.refreshAudio("silent microphone");
      }
    }, 500);
    return () => clearInterval(t);
  }, [liveMode]);

  // Safari may hold back the voice of a call the app started by itself: any tap lets it play.
  useEffect(() => {
    const onTap = () => {
      if (!liveActive.current) return;
      nudgeAudio();
      if (!approving.current) void liveSession.current?.refreshAudio("tap"); // never while the fingerprint prompt opens
    };
    document.addEventListener("pointerdown", onTap);
    return () => document.removeEventListener("pointerdown", onTap);
  }, []);

  // A conversation nobody is talking in ends by itself after 40 seconds, to save voice minutes.
  const lastLineAt = useRef(0);
  useEffect(() => {
    lastLineAt.current = Date.now();
  }, [liveLines.length, liveMode]);
  useEffect(() => {
    const t = setInterval(() => {
      if (liveActive.current && liveModeRef.current === "listening" && Date.now() - lastLineAt.current > 40000) liveSession.current?.end();
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Between conversations, keep listening for free for a greeting, then start talking again: a blind
  // customer should never have to find a button to restart the voice.
  const wakeOk = Boolean(autoOk && !liveMode && !needTap && canWake());
  useEffect(() => {
    if (!wakeOk) {
      setStandby(false);
      return;
    }
    const pendingId = state?.pending?.debitAmount ? state.pending.id : undefined;
    const stop = startWake(
      () => {
        setStandby(false);
        void startLiveVoice(pendingId);
      },
      (why) => {
        report("standby listening blocked:", why);
        setStandby(false);
      },
    );
    setStandby(Boolean(stop));
    return () => stop?.();
  }, [wakeOk, state?.pending?.id, state?.pending?.debitAmount, startLiveVoice]);

  // Speak a new request once when it arrives with its exact amount.
  const pending = state?.pending ?? null;
  useEffect(() => {
    if (pending && pending.debitAmount && spokenFor.current !== pending.id) {
      spokenFor.current = pending.id;
      if (pending.id === sentByVoice.current) return; // the customer asked for it by voice; the agent is already talking about it
      if (liveActive.current && liveFor.current === pending.id) return; // the agent is already talking about it
      if (liveActive.current && liveFor.current !== pending.id) {
        // A seller asked during a conversation: start again about this request, so the agent has its facts.
        liveSession.current?.end();
        setTimeout(() => void startLiveVoice(pending.id), 800);
        return;
      }
      if (prefs.on && prefs.natural && prefs.auto && !liveActive.current) {
        void startLiveVoice(pending.id);
        return;
      }
      if (inNativeApp() && prefs.on && prefs.listen && canListen()) return; // the approval screen asks by voice itself
      if (prefs.on && prefs.listen && canListen()) {
        sayOurs({ what: "asking", id: pending.id }, `${requestSentence(pending)} Tap the screen to talk about it.`);
        return;
      }
      say(`${requestSentence(pending)} Tap anywhere to hear this again.`);
    }
  }, [pending, say, sayOurs, prefs, startLiveVoice]);

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

  // Stage mode: send what is happening to the studio page (/stage?k=…). The agent's voice goes from liveVoice.
  const hasCustomer = Boolean(state?.customer);
  const [stageKey, setStageKey] = useState("");
  useEffect(() => {
    if (!hasCustomer || !stageMode()) return;
    stageOpen(LIVE_KEY, (why) => report("studio feed", why));
    setStageKey(LIVE_KEY);
  }, [hasCustomer]);
  useEffect(() => {
    if (!stageKey || !state?.customer) return;
    const c = state.customer;
    const snap = () =>
      stageSend("snap", {
        name: c.name ?? "Customer",
        left: c.cap?.left ?? null,
        limit: c.cap?.limit ?? null,
        every: c.cap?.every ?? null,
        pending: stageBrief(state.pending ?? null),
        last: stageBrief(state.last ?? null),
        mode: liveModeRef.current,
        lines: liveLines.slice(-6),
      });
    snap();
    const t = setInterval(snap, 2000);
    return () => clearInterval(t);
  }, [stageKey, state, liveLines]);
  useEffect(() => {
    if (!stageKey) return;
    stageSend("mode", { mode: liveMode });
    if (liveMode !== "listening") return;
    const t = setInterval(() => stageSend("level", { v: liveSession.current?.levels().input ?? 0 }), 150);
    return () => clearInterval(t);
  }, [stageKey, liveMode]);

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

  if (pending)
    return (
      <Approve
        key={pending.id}
        request={pending}
        fingerprint={state.customer.fingerprint}
        cap={state.customer.cap}
        prefs={prefs}
        say={say}
        sayOurs={sayOurs}
        onDone={finish}
        live={live}
      />
    );

  if (needTap && !liveMode)
    return (
      <button
        className="tap-to-talk"
        onClick={() => {
          setNeedTap(false);
          void startLiveVoice().then((ok) => setNeedTap(!ok));
        }}
      >
        <span className="tap-ring" aria-hidden="true">
          <Icon name="mic" size={44} />
        </span>
        <span className="tap-title">Tap anywhere to talk to Pay Alone</span>
        <span className="tap-sub">The voice could not start by itself on this device.</span>
      </button>
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
        savePref("autoTalk", next.auto ? "on" : "off");
        savePref("lang", next.lang);
        if (!next.on) hosted.stop();
      }}
      sayOurs={sayOurs}
      say={say}
      refresh={() => void refresh()}
      setNotice={setNotice}
      live={live}
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
        <LinkForm onDone={onDone} />
        <p className="lead">New to Pay Alone? This is done once. Enter the wallet address you pay from.</p>
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

function isHomeScreenApp(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

/** The Home Screen app has its own sign-in, separate from Safari. A one-time code links it to the same customer. */
function LinkForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/wallet/link", { method: "PUT", body: { code } });
      onDone();
    } catch (err) {
      setError(errorText(err).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: "40rem" }}>
      <h2>Already use Pay Alone in Safari?</h2>
      <p className="muted">
        In Safari, open Pay Alone, then &quot;Lock-screen alerts&quot;, then &quot;Get a link code&quot;. Enter the six digits here. You keep your limit, fingerprint
        and history.
      </p>
      <label htmlFor="link">Link code</label>
      <input id="link" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      <button className="wide" disabled={busy || code.replace(/\D/g, "").length !== 6}>
        {busy ? "Linking…" : "Link this app"}
      </button>
    </form>
  );
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/** Lock-screen alerts (Web Push). On iPad and iPhone this works only in the Home Screen app. */
function Alerts({ say }: { say: (t: string) => void }) {
  const [status, setStatus] = useState<"checking" | "unsupported" | "needs-home-screen" | "off" | "denied" | "on">("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        const apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;
        setStatus(apple && !isHomeScreenApp() ? "needs-home-screen" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub && Notification.permission === "granted" ? "on" : "off");
      let again = false;
      try {
        again = sessionStorage.getItem("alertsAfterReload") === "1";
        sessionStorage.removeItem("alertsAfterReload");
      } catch {}
      if (again && !sub) setMessage("Tap Turn on alerts once more to finish.");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    let step = "asking permission";
    const limit = <T,>(p: Promise<T>, secs: number): Promise<T> =>
      Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`no answer after ${secs} seconds`)), secs * 1000))]);
    const at = (s: string) => {
      step = s;
      setMessage(`Turning on: ${s}…`);
    };
    try {
      // Ask first, straight from the tap: iPadOS only allows the question from a tap.
      at("asking permission");
      const permission = await limit(Notification.requestPermission(), 60);
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setMessage("Alerts were not allowed.");
        return;
      }
      at("getting the server key");
      const { publicKey } = await limit(api<{ publicKey: string | null }>("/api/wallet/push"), 15);
      if (!publicKey) throw new Error("Alerts are not set up on the server yet.");
      at("starting the alert service");
      const reg = await limit(navigator.serviceWorker.register("/sw.js", { scope: "/" }), 15);
      if (!reg.active) {
        const w = reg.installing ?? reg.waiting;
        await limit(
          new Promise<void>((done) => {
            if (!w) return done();
            w.addEventListener("statechange", () => w.state === "activated" && done());
          }),
          15,
        );
      }
      // iPadOS can leave subscribe() waiting forever when this page is not yet controlled by the
      // service worker (first open of the Home Screen app). Reload once so it is, then finish.
      if (!navigator.serviceWorker.controller) {
        report("alerts: page not controlled, reloading", `sw=${reg.active?.state ?? "none"}`);
        try {
          sessionStorage.setItem("alertsAfterReload", "1");
        } catch {}
        setMessage("Almost done. The app reloads; then tap Turn on alerts once more.");
        say("Almost done. The app reloads. Then tap Turn on alerts once more.");
        setTimeout(() => window.location.reload(), 2500);
        return;
      }
      at("getting an alert address from Apple");
      const old = await reg.pushManager.getSubscription();
      const sub = old ?? (await limit(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(publicKey) }), 30));
      at("saving");
      await limit(api("/api/wallet/push", { method: "POST", body: { subscription: sub.toJSON() } }), 15);
      setStatus("on");
      const t = "Lock-screen alerts are on. When a seller asks you for money, this iPad will alert you, even when it is locked.";
      setMessage(t);
      say(t);
    } catch (e) {
      const why = e instanceof Error ? e.message : errorText(e).message;
      report(
        `alerts failed at ${step}: ${why} | controlled=${Boolean(navigator.serviceWorker.controller)} permission=${Notification.permission} standalone=${isHomeScreenApp()}`,
      );
      setMessage(`Alerts could not be turned on (${step}): ${why}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const t = "Test alert in 10 seconds. Lock the iPad now if you want to hear it on the lock screen.";
    setMessage(t);
    say(t);
    try {
      const r = await api<{ sent: number; failed: number }>("/api/wallet/push", { method: "PUT", body: { delaySeconds: 10 } });
      setMessage(r.sent ? "Test alert sent." : "The test alert could not be sent. Turn alerts off and on again.");
    } catch (e) {
      setMessage(errorText(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function getLink() {
    setBusy(true);
    try {
      const r = await api<{ code: string }>("/api/wallet/link", { method: "POST" });
      setLink(r.code);
      const d = r.code.split("").join(" ");
      say(`Your link code is ${d}. Again: ${d}. It works for ten minutes, once.`);
    } catch (e) {
      setMessage(errorText(e).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;
  return (
    <section aria-labelledby="alerts-h" style={{ marginTop: "1.2rem" }}>
      <h2 id="alerts-h">Lock-screen alerts (test)</h2>
      {status === "on" && <p>On. A seller&apos;s request alerts this device even when it is locked. VoiceOver reads the alert; unlock with your fingerprint to answer.</p>}
      {status === "off" && <p>Hear a seller&apos;s request even when this device is locked. You still unlock with your fingerprint to pay.</p>}
      {status === "denied" && <p>Alerts are blocked for Pay Alone. Allow them in Settings, then Notifications, then Pay Alone.</p>}
      {status === "unsupported" && <p className="muted">This browser cannot show lock-screen alerts.</p>}
      {status === "needs-home-screen" && (
        <>
          <p>On iPad, alerts work only when Pay Alone is on the Home Screen.</p>
          <ol>
            <li>Tap Share, at the top of Safari, then &quot;Add to Home Screen&quot;, then Add.</li>
            <li>Tap &quot;Get a link code&quot; below. Open Pay Alone from the new Home Screen icon and enter the code.</li>
            <li>In the Home Screen app, tap &quot;Turn on alerts&quot;.</li>
          </ol>
        </>
      )}
      {(status === "off" || status === "denied") && (
        <button className="wide" disabled={busy || status === "denied"} onClick={() => void turnOn()}>
          <Icon name="bell" size={22} /> {busy ? "Turning on…" : "Turn on alerts"}
        </button>
      )}
      {status === "on" && (
        <button className="wide secondary" disabled={busy} onClick={() => void test()}>
          <Icon name="bell" size={22} /> Send me a test alert
        </button>
      )}
      {!isHomeScreenApp() && (
        <button className="wide secondary" disabled={busy} onClick={() => void getLink()}>
          Get a link code
        </button>
      )}
      {link && (
        <p className="code" aria-label={`Link code ${link.split("").join(" ")}`}>
          {link}
        </p>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
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
  live,
}: {
  request: RequestView;
  fingerprint: CustomerView["fingerprint"];
  cap: CapView | null;
  prefs: VoicePrefs;
  say: (t: string) => void;
  sayOurs: (params: Record<string, string>, fallbackText: string) => void;
  onDone: (r: RequestView, quiet?: boolean) => void;
  live: Live;
}) {
  const needsFinger = fingerprint.length > 0;
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hearing, setHearing] = useState<"" | "speaking" | "listening" | "thinking">("");
  const [talk, setTalk] = useState<{ who: "app" | "you"; text: string }[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => stageSend("prompt", { id: request.id, text: message }), [message, request.id]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const autoAsked = useRef(false);
  // While the live conversation runs, the agent does the talking.
  const liveOn = live.active;
  const toolWait = useRef<((s: string) => void) | null>(null);
  const toolText = useRef("");
  const voiceDown = useRef(false); // the voice could not start here; taps go straight to paying
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

  // Let the agent pay or refuse this request while it is on screen.
  useEffect(() => {
    const h = live.handlers;
    h.current = {
      approve: async () => {
        toolText.current = "";
        void sayHowTo();
        const s = await activateRef.current(true);
        if (s === "done") return toolText.current || "not paid: the wallet did not answer.";
        if (s === "waiting") {
          setMessage(needsFinger ? "Tap the screen once, then rest your finger on the Home button." : "Tap the screen once to pay.");
          return new Promise<string>((res) => (toolWait.current = res));
        }
        return s || "not paid: nothing happened.";
      },
      refuse: () => {
        const p = new Promise<string>((res) => (toolWait.current = res));
        void refuseRef.current();
        return p;
      },
      ended: () => settleTool("not paid: the conversation ended."),
    };
    return () => {
      h.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inside the iPad app the request is read out and the app listens without any tap at all.
  useEffect(() => {
    if (ready && voiceAnswers && inNativeApp() && !autoAsked.current) {
      autoAsked.current = true;
      void talk_();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, voiceAnswers]);

  /**
   * Tells the customer what to do to approve, in the app's own voice and their language, once the agent
   * has stopped talking. Said every time: a blind customer must never be left waiting for a prompt they
   * cannot see, whatever the agent said.
   */
  async function sayHowTo() {
    const how = !needsFinger ? "tap" : (inNativeApp() && fingerprint.some((f) => f.kind === "device")) || fingerNoTap() !== "tap" ? "finger" : "tapFinger";
    const text =
      how === "finger" ? "Now rest your finger on the Home button to pay." : how === "tap" ? "Now tap the screen once to pay." : "Now tap the screen once, then rest your finger on the Home button.";
    for (let i = 0; i < 25 && live.session.current && live.modeNow() === "speaking"; i++) await new Promise((r) => setTimeout(r, 200));
    await new Promise((r) => setTimeout(r, 400));
    setMessage(text);
    if (prefs.natural) await hosted.play({ what: "howto", how, id: request.id, lang: prefs.lang }, text);
    else await voice.speak(text);
  }

  function settleTool(text: string) {
    const w = toolWait.current;
    toolWait.current = null;
    w?.(text);
  }

  /** Finishes a payment or refusal. In a live conversation the agent tells the result. */
  async function done(r: RequestView) {
    if (r.status === "paid") successChime(); // a happy sound the moment it is paid (also in the studio)
    if (!liveOn.current) return onDone(r);
    const paid = r.status === "paid" && r.paid;
    const left = paid ? await live.leftNow() : "";
    toolText.current = paid
      ? `paid: ${speakAmount(r.paid!.debitAmount)} left the customer's account to ${r.merchantName}.${left}`
      : r.status === "declined"
        ? "refused. No money moved."
        : `not paid: ${r.failure?.message ?? "the wallet did not pay"}. No money moved.`;
    settleTool(toolText.current);
    onDone(r, true);
  }

  /** The live conversation: natural voice, the customer can interrupt, the agent answers questions. */
  async function talk_(): Promise<boolean> {
    if (liveOn.current || busy || !ready) return true;
    setMessage("Connecting the voice…");
    if (await live.start(request.id)) {
      setMessage("Talk naturally. Ask who is asking, how much is left, or say pay or no.");
      return true;
    }
    return false;
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
    // If the voice is not available on this device (no microphone, voice service down), taps pay instead.
    if (!spoken && !armed && voiceAnswers && !voiceDown.current) {
      if (prefs.natural ? await talk_() : await askByVoice().then(() => true, () => false)) return "";
      voiceDown.current = true;
      const text = needsFinger
        ? "The voice is not available right now. Tap again, then rest your finger on the Home button to pay. To refuse, do nothing."
        : "The voice is not available right now. Tap again to pay. To refuse, do nothing.";
      setMessage(text);
      say(text);
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
        if (spoken && !useNative) rememberFingerNoTap("ok");
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
        if (spoken && !useNative) {
          // This browser needs a tap before the fingerprint prompt: remember it, and have the voice say so now.
          if (fingerNoTap() !== "tap") {
            rememberFingerNoTap("tap");
            live.session.current?.nudge("(The app: the fingerprint prompt could not open by itself on this iPad. Tell the customer now, once: tap the screen anywhere, then rest your finger on the Home button.)");
          }
          return "waiting";
        }
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
        live.end();
        setTimeout(() => window.location.assign(res.redirectUrl!), 300);
        return "redirect";
      }
      await done(res.request);
    } catch (e) {
      const err = errorText(e);
      await done({ ...request, status: "failed", failure: { kind: err.kind, message: err.message, walletSaid: err.walletSaid } });
    }
    return "done";
  }

  const activateRef = useRef(activate);
  activateRef.current = activate;
  const refuseRef = useRef(refuse);
  refuseRef.current = refuse;

  async function refuse() {
    setBusy(true);
    try {
      const res = await api<{ request: RequestView }>(`/api/wallet/requests/${request.id}/decline`, { method: "POST" });
      await done(res.request);
    } catch (e) {
      const err = errorText(e);
      await done({ ...request, status: "failed", failure: { kind: err.kind, message: err.message } });
    }
  }

  const instruction = !ready
    ? "Getting the exact amount from your wallet…"
    : busy
      ? "Paying. Please wait."
      : live.mode && armed
        ? needsFinger
          ? "Tap once, then rest your finger on the Home button."
          : "Tap the screen to pay."
        : live.mode === "connecting"
          ? "Connecting the voice…"
          : live.mode === "speaking"
            ? "Speaking… you can interrupt any time."
            : live.mode === "listening"
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

  const fee =
    request.debitAmount && request.receiveAmount && request.debitAmount.assetCode === request.receiveAmount.assetCode
      ? { ...request.debitAmount, value: (BigInt(request.debitAmount.value) - BigInt(request.receiveAmount.value)).toString() }
      : null;
  const leftAfter =
    cap && cap.status === "active" && request.debitAmount && cap.left.assetCode === request.debitAmount.assetCode
      ? { ...cap.left, value: (BigInt(cap.left.value) - BigInt(request.debitAmount.value)).toString() }
      : null;
  return (
    <div className="takeover" role="dialog" aria-modal="true" aria-label="Payment request">
      <button
        ref={buttonRef}
        className={`approve pay-sheet ${armed || hearing === "listening" ? "armed" : ""}`}
        onClick={() => void activate()}
        disabled={busy}
        aria-describedby="approve-how"
      >
        <span className="pay-head">
          <Peep name={request.merchantName} size={84} />
          <span className="pay-who">{titleCase(request.merchantName)}</span>
          <span className="pay-what">{request.outgoing ? "You are sending money" : "is asking you to pay"}</span>
          {!request.knownPayee && <span className="new-tag">New person</span>}
        </span>
        <span className="pay-stack">
          <span className="pay-card lime">
            <span className="pc-label">You pay</span>
            {request.debitAmount ? <Money a={request.debitAmount} size="lg" /> : <span className="money lg">Checking…</span>}
            <span className="pc-foot">{leftAfter
                ? BigInt(leftAfter.value) < BigInt(0)
                  ? "More than what is left of your limit"
                  : `Left of your limit after this: ${formatAmount(leftAfter)}`
                : "Fees included"}</span>
          </span>
          <span className="pay-link">to {titleCase(request.merchantName)}</span>
          <span className="pay-card dark">
            <span className="pc-label">{request.outgoing ? "They get" : `${titleCase(request.merchantName)} gets`}</span>
            <Money a={request.receiveAmount ?? request.requested} size="lg" />
            <span className="pc-foot">{fee && fee.value !== "0" ? `Fee ${formatAmount(fee)}` : "No fee"}</span>
          </span>
        </span>
        <span className="pay-bar" id="approve-how">
          <span className="pay-knob">
            <Icon name={icon} size={26} />
          </span>
          <span className="pay-bar-text">{instruction}</span>
        </span>
      </button>
      <div className="sr-only" role="status" aria-live="assertive">
        {message}
      </div>
      <aside className={`voice-panel pay-voice ${live.mode || hearing || talk.length ? "on" : ""}`} aria-label="Talking about this request">
        <header className="vp-top">
          <span>
            <b>Pay Alone</b>
            <span className={`vp-status ${live.mode}`}>
              {live.mode === "speaking" ? "Speaking" : live.mode === "listening" || hearing === "listening" ? "Listening" : live.mode === "connecting" ? "Connecting" : "Ready"}
            </span>
          </span>
        </header>
        <div className="vp-stage">
          <span className="vp-arc a1" />
          <span className="vp-arc a2" />
          <VoiceOrb session={live.session} mode={live.mode || (hearing === "listening" ? "listening" : hearing === "speaking" ? "speaking" : "")} small />
        </div>
        <ol className="vp-talk" aria-label="Conversation">
          {!live.mode && talk.length === 0 && <li className="app">Tap anywhere on the left and talk to me about this request. Your fingerprint pays; your voice never does.</li>}
          {(live.mode ? live.lines : talk).slice(-4).map((t, i) => (
            <li key={i} className={t.who}>
              <span className="sr-only">{t.who === "you" ? "You said: " : "Pay Alone said: "}</span>
              {t.text}
            </li>
          ))}
        </ol>
      </aside>
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
function VoiceOrb({ session, mode, small = false }: { session: React.RefObject<LiveSession | null>; mode: LiveMode | ""; small?: boolean }) {
  const level = () => {
    const l = session.current?.levels() ?? { input: 0, output: 0 };
    return Math.min(1, (mode === "speaking" ? l.output : mode === "listening" ? l.input : 0) * 2.2);
  };
  return <GlassOrb mode={mode || "idle"} level={mode ? level : undefined} size={small ? "9rem" : "min(16rem, 62vw)"} />;
}

// ---------- talking to Pay Alone ----------

function liveLabel(mode: LiveMode | "", standby = false) {
  return mode === "connecting"
    ? "Connecting…"
    : mode === "speaking"
      ? "Speaking · interrupt any time"
      : mode === "listening"
        ? "Listening · talk naturally"
        : standby
          ? "Say “Hello Pay Alone” to talk"
          : "Tap to talk";
}

/** The voice, in one lit panel: the glass orb, what was said, and the mic. Always on the side on iPad. */
function VoiceStage({ live, onTalk, name, full = false }: { live: Live; onTalk: () => void; name?: string; full?: boolean }) {
  const [stageOn, setStageOn] = useState(false);
  const [studio, setStudio] = useState("");
  useEffect(() => {
    setStageOn(stageMode());
    const t = setInterval(() => setStudio(stageStatus()), 1000);
    return () => clearInterval(t);
  }, []);
  const on = Boolean(live.mode);
  const lines = on ? live.lines.slice(-3) : [];
  return (
    <>
      <header className="vp-top">
        <span>
          <b>Pay Alone</b>
          <span className={`vp-status ${live.mode}`}>{live.mode === "speaking" ? "Speaking" : live.mode === "listening" ? "Listening" : live.mode === "connecting" ? "Connecting" : live.standby ? "Waiting for “hello”" : "Ready"}
            {stageOn ? ` · Stage mode · studio ${studio === "SUBSCRIBED" ? "connected ✓" : studio ? `not connected (${studio})` : "starting"}` : ""}</span>
        </span>
        {on && (
          <button className="round dark" onClick={live.end} aria-label="End conversation">
            <Icon name="cross" size={18} />
          </button>
        )}
      </header>
      <div className="vp-stage">
        <span className="vp-arc a1" />
        <span className="vp-arc a2" />
        <VoiceOrb session={live.session} mode={live.mode} />
      </div>
      <ol className="vp-talk" aria-label="Conversation">
        {lines.length === 0 && !on && (
          <li className="app">
            Hello{name ? ` ${name}` : ""}. {live.standby ? "Just say “Hello Pay Alone” and I will answer. " : ""}Ask me what is left to spend, who you paid, or tell me who to send money to.
          </li>
        )}
        {lines.map((t, i) => (
          <li key={i} className={t.who}>
            <span className="sr-only">{t.who === "you" ? "You said: " : "Pay Alone said: "}</span>
            {t.text}
          </li>
        ))}
      </ol>
      <div className="vp-dock">
        <span className="vp-tip" role="status">
          {liveLabel(live.mode, live.standby)}
        </span>
        <button className={`vp-mic ${live.mode}`} onClick={on ? live.end : onTalk} aria-label={on ? "End conversation" : "Talk to Pay Alone"}>
          <span className="rp" />
          <span className="rp r2" />
          <span className="rp r3" />
          <span className="vp-mic-core">
            <Icon name={on ? "cross" : "mic"} size={30} />
          </span>
        </button>
        {full && <span className="sr-only">Pay Alone conversation</span>}
      </div>
    </>
  );
}

function VoicePanel({ live, onTalk, name }: { live: Live; onTalk: () => void; name?: string }) {
  return (
    <aside className="voice-panel" aria-label="Talk to Pay Alone">
      <VoiceStage live={live} onTalk={onTalk} name={name} />
    </aside>
  );
}

/** On a phone, the conversation fills the screen in the same lit panel. */
function LiveOverlay({ live }: { live: Live }) {
  return (
    <div className="voice-panel voice-full" role="dialog" aria-modal="true" aria-label="Talking to Pay Alone">
      <VoiceStage live={live} onTalk={() => undefined} full />
    </div>
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
  live: Live;
}) {
  const { customer, notice, say, live } = props;
  const cap = customer.cap;
  const digits = customer.payCode.split("").join(" ");
  const name = customer.name ? titleCase(customer.name) : "";
  const active = cap && cap.status === "active" ? cap : null;
  const pct = active ? Number((BigInt(active.spent.value) * BigInt(100)) / (BigInt(active.limit.value) || BigInt(1))) : 0;
  const leftPct = active ? Math.max(0, 100 - pct) : 0;
  const week = weekSummary(props.history);
  const people = peopleOf(props.history);
  const [note, setNote] = useState("");
  async function talk() {
    setNote("");
    if (!(await live.start())) {
      const text = "The voice is not available right now. Please try again in a moment.";
      setNote(text);
      say(text);
    }
  }
  const openSettings = () => {
    const d = document.getElementById("settings") as HTMLDetailsElement | null;
    if (d) d.open = true;
  };
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const [showCode, setShowCode] = useState(false);
  const [showGrow, setShowGrow] = useState(false);
  useEffect(() => {
    const openGrow = () => setShowGrow(true);
    window.addEventListener("payalone:show-grow", openGrow);
    return () => window.removeEventListener("payalone:show-grow", openGrow);
  }, []);
  useEffect(() => {
    const open = () => setShowCode(true);
    window.addEventListener("payalone:show-code", open);
    return () => window.removeEventListener("payalone:show-code", open);
  }, []);

  return (
    <div className="dash">
      <aside className="rail" aria-label="Main">
        <span className="rail-logo" aria-hidden="true">
          <Icon name="shield" size={22} />
        </span>
        <a href="#top" className="rail-btn on" aria-label="Home">
          <Icon name="home" />
        </a>
        <button className="rail-btn" aria-label="Talk to Pay Alone" onClick={() => void talk()}>
          <Icon name="mic" />
        </button>
        <a href="#payments" className="rail-btn" aria-label="Your payments">
          <Icon name="list" />
        </a>
        <button className="rail-btn" aria-label="Show my pay code and QR code" onClick={() => setShowCode(true)}>
          <Icon name="qr" />
        </button>
        <a href="#safety" className="rail-btn" aria-label="Limit and fingerprint">
          <Icon name="shield" />
        </a>
        <a href="#settings" className="rail-btn" aria-label="Voice and settings" onClick={openSettings}>
          <Icon name="gear" />
        </a>
        <span className="rail-me">
          <Peep name={customer.name ?? "you"} bg="ffffff" size={46} self />
        </span>
      </aside>

      <main className="board" id="top">
        <header className="board-top">
          <div>
            <p className="hi">Hi {name || "there"},</p>
            <h1 className="welcome">Welcome back!</h1>
            <p className="sub">{today}</p>
          </div>
          <div className="top-actions">
            <span className="chip-soft">
              <span className="live-dot" /> Test wallet connected
            </span>
            <a href="#settings" className="round" aria-label="Voice and settings" onClick={openSettings}>
              <Icon name="gear" />
            </a>
          </div>
        </header>

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
        {note && <p role="status">{note}</p>}

        <section className="row-1">
          <div className="wallet-stack" aria-label="Your wallet">
            <div className="stack-top">
              <div className="stack-row">
                <span>{name || "Your wallet"}</span>
                <span className="op-mark">Open Payments</span>
              </div>
              <div className="stack-row strong">
                <span>Pay code&nbsp;&nbsp;{customer.payCode.replace(/(\d{3})(\d{3})/, "$1 $2")}</span>
                <button className="qr-chip" onClick={() => setShowCode(true)} aria-label="Show my QR code">
                  <Icon name="qr" size={18} /> QR
                </button>
                <span className="cur-mark">{customer.assetCode}</span>
              </div>
            </div>
            <div className="stack-body">
              <span className="notch" aria-hidden="true" />
              <div className="frame">
                <span className="coin" aria-hidden="true">
                  {symbolOf(customer.assetCode)}
                </span>
                {active ? <Money a={active.left} size="xl" /> : <span className="money xl">No limit</span>}
                <span className="frame-label">{active ? `Left to spend this ${active.every}, of ${formatAmount(active.limit)}` : "Set a spending limit below"}</span>
                {active && (
                  <span className="frame-bar" aria-hidden="true">
                    <span style={{ width: `${leftPct}%` }} />
                  </span>
                )}
              </div>
              <div className="pill-row">
                <button
                  className="pill ghost"
                  onClick={() => say(active ? `${speakAmount(active.left)} is left to spend this ${active.every}.` : "You have no spending limit set.")}
                >
                  <Icon name="speaker" size={20} /> Say it aloud
                </button>
                <button className="pill solid" onClick={() => void talk()} disabled={Boolean(live.mode)}>
                  <Icon name="mic" size={20} /> Talk
                </button>
              </div>
            </div>
          </div>

          {customer.balance && (
            <div className="card chart-card" aria-label="Account balance">
              <div className="card-top">
                <span className="chip-coin" aria-hidden="true">
                  {symbolOf(customer.balance.amount.assetCode)}
                </span>
                <b>Account balance</b>
              </div>
              <Money a={customer.balance.amount} size="lg" />
              <button className="pill ghost" onClick={() => say(`Your balance is about ${speakAmount(customer.balance!.amount)}.`)}>
                <Icon name="speaker" size={20} /> Say it aloud
              </button>
            </div>
          )}

          <div className="card chart-card">
            <div className="card-top">
              <span className="chip-coin" aria-hidden="true">
                {symbolOf(customer.assetCode)}
              </span>
              <b>Spent this week</b>
              {active && <span className="pct">{pct}%</span>}
            </div>
            {active ? <Money a={active.spent} size="lg" /> : <Money a={{ value: week.total, assetCode: customer.assetCode, assetScale: customer.assetScale }} size="lg" />}
            <span className="muted">
              {week.paid} paid · {week.refused} not paid
            </span>
            <div className="bars" aria-hidden="true">
              {week.days.map((d) => (
                <span key={d.label} className={`bar ${d.today ? "today" : ""}`}>
                  <span className="bar-col">
                    <span className="bar-fill" style={{ height: `${Math.max(6, (d.value / week.max) * 100)}%` }} />
                  </span>
                  <span className="bar-d">{d.label}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="row-2">
          <div className="card" id="people">
            <div className="card-head2">
              <b>People you pay</b>
            </div>
            <div className="people">
              {people.slice(0, 3).map((p) => (
                <div key={p.name} className="person">
                  <Peep name={p.name} size={56} />
                  <b>{titleCase(p.name)}</b>
                  <span>{p.paid ? `Paid ${p.paid === 1 ? "once" : `${p.paid} times`}` : "Asked recently"}</span>
                </div>
              ))}
              <button className="person add" onClick={() => void talk()} aria-label="Send money by voice">
                <span className="add-btn">+</span>
                <b>Send</b>
                <span>By voice</span>
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head2">
              <b>Recent activity</b>
              <a className="link" href="#payments">
                History
              </a>
            </div>
            {props.history.length === 0 ? (
              <p className="muted">No payments yet.</p>
            ) : (
              <ol className="activity">
                {props.history.slice(0, 3).map((h) => (
                  <li key={h.id}>
                    <Peep name={h.merchantName} size={44} />
                    <span className="act-text">
                      <b>{titleCase(h.merchantName)}</b>
                      <span>
                        {h.status === "paid" ? "Paid" : h.status === "declined" ? "Refused" : h.status === "expired" ? "Timed out" : "Not paid"} ·{" "}
                        {new Date(h.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className={`act-amt ${h.status === "paid" ? "" : "off"}`}>
                      {h.status === "paid" ? "−" : ""}
                      {formatAmount(h.debitAmount ?? h.requested)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="row-3" id="safety">
          <div className="safe">
            <span className="safe-ic">
              <Icon name="finger" />
            </span>
            <span>
              <b>{customer.fingerprint.length ? "Fingerprint on" : "Fingerprint not set up"}</b>
              <span>{customer.fingerprint.length ? "Every payment needs your finger" : "Set it up below"}</span>
            </span>
          </div>
          <div className="safe">
            <span className="safe-ic">
              <Icon name="shield" />
            </span>
            <span>
              <b>{active ? "Limit set by your wallet" : "No limit yet"}</b>
              <span>{active ? `${formatAmount(active.limit)} a ${active.every}; it refuses more` : "Set one below"}</span>
            </span>
          </div>
          <button className="safe safe-btn" onClick={() => setShowCode(true)}>
            <span className="safe-ic">
              <Icon name="qr" />
            </span>
            <span>
              <b>Show my QR code</b>
              <span>Pay code {customer.payCode.replace(/(\d{3})(\d{3})/, "$1 $2")} · set it as lock screen</span>
            </span>
          </button>
          <button className="safe safe-btn" onClick={() => setShowGrow(true)}>
            <span className="safe-ic">
              <Icon name="home" />
            </span>
            <span>
              <b>Save and invest</b>
              <span>Grow your money · live share prices · practice investing</span>
            </span>
          </button>
        </section>

        <section className="card" aria-labelledby="code-h" id="code">
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

        <div id="payments">
          <History items={props.history} say={say} />
        </div>

        <details className="card" id="settings">
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
          <label className="toggle">
            <input
              type="checkbox"
              checked={props.prefs.auto}
              disabled={!props.prefs.on || !props.prefs.natural}
              onChange={(e) => props.setPrefs({ ...props.prefs, auto: e.target.checked })}
            />
            <span>Start talking as soon as the app opens. Uses voice minutes each time; the call ends when you leave the app or stay quiet.</span>
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
          <Alerts say={say} />
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

        <nav className="dock" aria-label="Main">
          <a href="#top" className="dock-btn on" aria-label="Home">
            <Icon name="home" size={24} />
          </a>
          <button className="dock-btn" aria-label="Talk to Pay Alone" onClick={() => void talk()}>
            <Icon name="mic" size={24} />
          </button>
          <a href="#payments" className="dock-btn" aria-label="Your payments">
            <Icon name="list" size={24} />
          </a>
          <a href="#settings" className="dock-btn" aria-label="Voice and settings" onClick={openSettings}>
            <Icon name="gear" size={24} />
          </a>
        </nav>
      </main>

      <VoicePanel live={live} onTalk={() => void talk()} name={name} />
      {showCode && <PayCodeSheet payCode={customer.payCode} say={say} onClose={() => setShowCode(false)} />}
      {showGrow && <GrowSheet say={say} onStarted={() => { setShowGrow(false); props.refresh(); }} onClose={() => setShowGrow(false)} />}
      {live.mode && <LiveOverlay live={live} />}
    </div>
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
  const [changing, setChanging] = useState(false);

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
    <section className="card" aria-labelledby="limit-h" id="limit">
      <div className="card-head">
        <span className="card-icon">
          <Icon name="shield" size={22} />
        </span>
        <h2 id="limit-h">Spending limit</h2>
      </div>
      {cap?.status === "active" && !changing ? (
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
          <button
            className="wide secondary"
            onClick={() => {
              setChanging(true);
              setAmount("");
              setEvery(cap.every);
            }}
          >
            <Icon name="shield" size={22} /> Change my limit
          </button>
          <button className="wide danger" disabled={busy} onClick={() => void stop()}>
            <Icon name="stop" size={22} /> {confirmStop ? "Tap again to stop everything" : "Stop everything"}
          </button>
        </>
      ) : (
        <form onSubmit={setLimit}>
          {changing && cap?.status === "active" && (
            <p>
              Your limit now: <strong>{formatAmount(cap.limit)}</strong> every {cap.every}. Enter the new limit, then confirm it on your wallet&apos;s page. The old
              limit stays until you do, and is cancelled once the new one is set.
            </p>
          )}
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
            {busy ? "Opening your wallet…" : changing ? "Set my new limit on the wallet's page" : "Set my limit on the wallet's page"}
          </button>
          {changing && (
            <button type="button" className="wide secondary" onClick={() => setChanging(false)}>
              Keep my current limit
            </button>
          )}
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
/** The pay code as a large QR, and setting it as the lock screen (once, with an Apple Shortcut). */
type GrowView = {
  saved: Amount | null;
  holdings: { symbol: string; name: string; shares: string; cost: Amount; value: Amount | null }[];
  market: { symbol: string; name: string; about: string; market: "NGX" | "US"; currency: "NGN" | "USD"; priceMinor: string; changeMonthBp: number | null; changeSixMonthBp?: number | null; asOf: string; source: string }[];
  savingsReady: boolean;
  investReady: boolean;
};
const priceOf = (q: GrowView["market"][number]) => (Number(q.priceMinor) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
const changeOf = (q: GrowView["market"][number]) =>
  q.changeMonthBp === null ? "" : `${q.changeMonthBp >= 0 ? "up" : "down"} ${Math.abs(q.changeMonthBp / 100).toFixed(1)} percent this month`;
const sixOf = (q: GrowView["market"][number]) =>
  q.changeSixMonthBp == null ? "" : `${q.changeSixMonthBp >= 0 ? "up" : "down"} ${Math.abs(q.changeSixMonthBp / 100).toFixed(1)} percent over six months`;
/** Ranked by the last six months (facts about the past), then each share with both changes. */
function marketLine(m: GrowView["market"]) {
  const ranked = m.filter((q) => q.changeSixMonthBp != null).sort((a, b) => b.changeSixMonthBp! - a.changeSixMonthBp!);
  const rank = ranked.length ? `Ranked by the last six months: ${ranked.map((q, i) => `${i + 1}. ${q.name} ${sixOf(q)}`).join("; ")}. Each share: ` : "";
  return (
    rank +
    m
      .map((q) => {
        const ch = [changeOf(q), sixOf(q)].filter(Boolean).join(", ");
        return `${q.name} (${q.about}): ${priceOf(q)} ${q.currency === "NGN" ? "naira" : "dollars"} a share${ch ? ", " + ch : ""}`;
      })
      .join("; ")
  );
}
function growLine(g: GrowView) {
  const s = g.saved ? `Saved so far: ${speakAmount(g.saved)}.` : "Nothing saved yet.";
  const h = g.holdings.length
    ? " Practice investments: " + g.holdings.map((x) => `${x.name}, ${x.shares} shares, cost ${speakAmount(x.cost)}${x.value ? `, worth ${speakAmount(x.value)} now` : ""}`).join("; ") + "."
    : " No practice investments yet.";
  return s + h;
}

function GrowSheet({ say, onStarted, onClose }: { say: (t: string) => void; onStarted: () => void; onClose: () => void }) {
  const [g, setG] = useState<GrowView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    void api<GrowView>("/api/wallet/grow")
      .then(setG)
      .catch((e) => setErr(errorText(e).message));
  }, []);
  async function start(body: Record<string, string>, label: string) {
    setBusy(label);
    setErr("");
    try {
      await api("/api/wallet/grow", { method: "POST", body: { currency: "USD", ...body } });
      say(`${label}. Your wallet is getting the exact amount. Then approve it with your fingerprint.`);
      onStarted();
    } catch (e) {
      setErr(errorText(e).message);
      say(errorText(e).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="sheet-back" role="dialog" aria-modal="true" aria-labelledby="grow-h" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "90vh", overflow: "auto" }}>
        <h2 id="grow-h">Save and invest</h2>
        <p>Real test money moves with Open Payments, approved by your fingerprint. Investing is <b>practice</b>: live prices, no real shares, not financial advice.</p>
        {err && <p role="alert">{err}</p>}
        {!g && !err && <p>Loading…</p>}
        {g && (
          <>
            <h3>Savings</h3>
            <p>{g.saved ? <>Saved so far: <b>{formatAmount(g.saved)}</b></> : "Nothing saved yet."}</p>
            {g.savingsReady ? (
              <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["1", "2", "5"].map((a) => (
                  <button key={a} className="safe-btn" disabled={Boolean(busy)} onClick={() => void start({ action: "save", amount: a }, `Saving ${a} dollars`)}>
                    Save ${a} (≈ ₦{nairaOf({ value: String(Number(a) * 100), assetCode: "USD", assetScale: 2 })})
                  </button>
                ))}
              </p>
            ) : (
              <p>The savings wallet is not set up yet.</p>
            )}
            <h3>Practice investments</h3>
            {g.holdings.length ? (
              <ul>
                {g.holdings.map((h) => (
                  <li key={h.symbol}>
                    {h.name}: {h.shares} shares · cost {formatAmount(h.cost)}
                    {h.value ? ` · worth ${formatAmount(h.value)} now` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>None yet.</p>
            )}
            {(["NGX", "US"] as const).map((mk) => (
              <div key={mk}>
                <h3>{mk === "NGX" ? "Nigerian Exchange (NGX)" : "US shares"}</h3>
                <p style={{ fontSize: 13 }}>
                  {mk === "NGX" ? "Daily prices from NGX; one-month change from TradingView." : "From Yahoo Finance, delayed; naira at the CBN rate of 16 Nov (₦1,353.97 per $1)."} Past changes do not predict the future.
                </p>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {g.market
                    .filter((q) => q.market === mk)
                    .map((q) => (
                      <li key={q.symbol} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #0001" }}>
                        <span>
                          <b>{q.name}</b> · {q.currency === "NGN" ? `₦${priceOf(q)}` : `$${priceOf(q)} (≈ ₦${nairaOf({ value: q.priceMinor, assetCode: "USD", assetScale: 2 })})`}
                          {q.changeMonthBp !== null && ` · ${q.changeMonthBp >= 0 ? "▲" : "▼"} ${Math.abs(q.changeMonthBp / 100).toFixed(1)}% this month`}
                          <br />
                          <small>{q.about}</small>
                        </span>
                        <button
                          className="safe-btn"
                          disabled={Boolean(busy) || !g.investReady}
                          onClick={() => void start({ action: "invest", share: q.symbol, amount: "1" }, `Practice investing 1 dollar, about 1,354 naira, in ${q.name}`)}
                        >
                          Invest ₦1,354 ($1)
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <p>
              <button className="safe-btn" onClick={() => say(`${growLine(g)} Live prices: ${marketLine(g.market)}. These are facts, not advice.`)}>
                Read it aloud
              </button>
            </p>
          </>
        )}
        <button className="safe-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function PayCodeSheet({ payCode, say, onClose }: { payCode: string; say: (t: string) => void; onClose: () => void }) {
  const digits = payCode.split("").join(" ");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void api<{ url: string }>("/api/wallet/lockscreen").then((r) => setLink(r.url)).catch(() => undefined);
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      say("The picture link is copied. Now open the Shortcuts app.");
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="sheet-back" role="dialog" aria-modal="true" aria-labelledby="sheet-h" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 id="sheet-h">Your pay code</h2>
          <button className="round" onClick={onClose} aria-label="Close">
            <Icon name="cross" size={20} />
          </button>
        </div>
        <div className="sheet-grid">
          <div className="sheet-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/wallet/paycode" alt={`QR code for pay code ${digits}`} />
            <p className="sheet-code" aria-label={`Pay code ${digits}`}>
              {payCode.replace(/(\d{3})(\d{3})/, "$1 $2")}
            </p>
            <p className="muted">A seller scans this or types the six digits to ask you for money. It cannot take money; only your fingerprint can.</p>
            <button className="wide secondary" onClick={() => say(`Your pay code is ${digits}. Again: ${digits}.`)}>
              <Icon name="speaker" size={20} /> Say it aloud
            </button>
          </div>
          <div className="sheet-steps">
            <h3>Put it on your lock screen</h3>
            <p className="muted">Then a seller can scan it without you unlocking anything.</p>
            <a className="button wide" href={link || "#"} target="_blank" rel="noreferrer" aria-disabled={!link}>
              Open the lock-screen picture
            </a>
            <p className="muted">Touch and hold the picture, choose Save to Photos, then in Photos choose Use as Wallpaper.</p>
            <h3>Or set it automatically (once)</h3>
            <ol>
              <li>
                <button className="secondary" onClick={() => void copy()} disabled={!link}>
                  {copied ? "Link copied" : "Copy my picture link"}
                </button>
              </li>
              <li>Open the Shortcuts app and tap +.</li>
              <li>Add the action “Get Contents of URL” and paste the link.</li>
              <li>Add the action “Set Wallpaper”, choose Lock Screen, and turn off Show Preview.</li>
              <li>Name it “Pay code wallpaper” and tap Run. Later just say “Hey Siri, pay code wallpaper”.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

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
