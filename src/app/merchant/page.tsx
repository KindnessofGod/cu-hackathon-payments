"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppBar, Icon } from "@/components/ui";
import { MerchantKey } from "@/components/MerchantKey";
import { startMirror } from "@/lib/mirror";
import { LIVE_KEY, stageOpen } from "@/lib/stage";
import { api, errorText, type ApiError } from "@/lib/client";
import { formatAmount as fmtPlain, nairaOf, type Amount } from "@/lib/money";

/** Dollars on the test network, with the naira figure for Nigerian sellers (display only). */
const formatAmount = (a: Amount) => (nairaOf(a) ? `${fmtPlain(a)} (≈ ₦${nairaOf(a)})` : fmtPlain(a));

interface MerchantData {
  simulated: boolean;
  merchant: { name: string; walletAddress: string; assetCode: string; assetScale: number };
  recentCustomers: { payCode: string; name: string }[];
  history: {
    id: string;
    at: string;
    status: string;
    requested: Amount;
    receiveAmount?: Amount;
    customerName: string;
    customerPayCode: string;
    reason?: string;
  }[];
}

interface View {
  id: string;
  status: "waiting" | "received" | "declined" | "expired" | "failed";
  requested: Amount;
  received: Amount;
  customerPayCode: string;
  expiresAt: string;
  reason?: string;
}

const STATUS_TEXT: Record<View["status"], string> = {
  waiting: "Waiting for the customer to approve",
  received: "Payment received",
  declined: "The customer said no",
  expired: "The request ran out of time",
  failed: "The payment failed",
};

export default function MerchantPage() {
  const [data, setData] = useState<MerchantData | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [payCode, setPayCode] = useState("");
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState<"NGN" | "USD">("NGN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [pollError, setPollError] = useState<ApiError | null>(null);
  const [scanning, setScanning] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoadError(null);
    api<MerchantData>("/api/merchant").then(setData, (e) => setLoadError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  // The studio screen shows this phone on the seller's side: once unlocked, send a live copy of it.
  const unlocked = Boolean(data);
  useEffect(() => {
    if (!unlocked) return;
    stageOpen(LIVE_KEY);
    return startMirror(undefined, "merchant");
  }, [unlocked]);

  // Poll the wallet for this request until it reaches a final state.
  useEffect(() => {
    if (!view || view.status !== "waiting") return;
    const t = setInterval(() => {
      api<View>(`/api/merchant/requests/${view.id}`).then(
        (v) => {
          setPollError(null);
          setView(v);
        },
        (e) => setPollError(errorText(e)),
      );
    }, 2000);
    return () => clearInterval(t);
  }, [view]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/merchant/requests", { method: "POST", body: { payCode, amount, currency: cur } });
      setView(await api<View>(`/api/merchant/requests/${id}`));
      setTimeout(() => statusRef.current?.focus(), 50);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setView(null);
    setAmount("");
    setPollError(null);
    load();
  }

  const naira = data?.merchant.assetCode === "USD" && cur === "NGN";

  return (
    <>
      <AppBar role="Seller" />
      <main>
        <h1>{data ? data.merchant.name : "Seller"}</h1>
        {loadError?.kind === "not_allowed" && <MerchantKey what="The seller page" onDone={load} />}
        {loadError && loadError.kind !== "not_allowed" && (
          <div className="status bad" role="alert">
            <p>Could not load the seller wallet. {loadError.message}</p>
            {loadError.walletSaid && <p className="muted">The wallet said: {loadError.walletSaid}</p>}
            <button onClick={load}>Try again</button>
          </div>
        )}
        {!data && !loadError && <p role="status">Loading the seller wallet…</p>}
        {data && (
          <p className="muted">
            Receiving in {data.merchant.assetCode} at {data.merchant.walletAddress}
          </p>
        )}

        <div className="split">
          {data && !view && (
            <form onSubmit={send} className="card">
              <div className="card-head">
                <span className="card-icon seller">
                  <Icon name="shop" size={22} />
                </span>
                <h2>Ask a customer to pay</h2>
              </div>
              <label htmlFor="paycode">Customer pay code</label>
              <input
                className="code-input"
                placeholder="000000"
                id="paycode"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9 ]{6,7}"
                required
                value={payCode}
                onChange={(e) => setPayCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button type="button" className="secondary wide" onClick={() => setScanning((s) => !s)} aria-expanded={scanning}>
                <Icon name="qr" size={22} /> {scanning ? "Close the camera" : "Scan the customer's code"}
              </button>
              {scanning && (
                <Scanner
                  onCode={(code) => {
                    setPayCode(code);
                    setScanning(false);
                  }}
                />
              )}
              {data.recentCustomers.length > 0 && (
                <fieldset style={{ border: 0, padding: 0, margin: "0.8rem 0 0" }}>
                  <legend style={{ fontWeight: 700, marginBottom: "0.4rem" }}>Recent customers</legend>
                  <div className="chips">
                    {data.recentCustomers.map((c) => (
                      <button key={c.payCode} type="button" className="chip" aria-pressed={payCode === c.payCode} onClick={() => setPayCode(c.payCode)}>
                        {c.name} · {c.payCode}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {data.merchant.assetCode === "USD" && (
                <div role="radiogroup" aria-label="Currency" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {(["NGN", "USD"] as const).map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={cur === c} className={cur === c ? "seller" : "secondary"} onClick={() => setCur(c)} style={{ flex: 1 }}>
                      {c === "NGN" ? "₦ Naira" : "$ Dollars"}
                    </button>
                  ))}
                </div>
              )}
              <label htmlFor="amount">Amount in {naira ? "naira" : data.merchant.assetCode}</label>
              <div className="money-input">
                <span aria-hidden="true">{naira ? "₦" : data.merchant.assetCode}</span>
                <input
                  id="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  placeholder={naira ? "2000" : "0.00"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {data.merchant.assetCode === "USD" && /^\d+(\.\d{1,2})?$/.test(amount.trim()) && Number(amount) > 0 && (
                <p className="muted" style={{ marginTop: 6 }}>
                  {naira
                    ? `≈ $${(Number(amount) / 1353.97).toFixed(2)} on the test network, which runs in dollars (CBN rate of 16 Nov, ₦1,353.97 per $1).`
                    : `≈ ₦${nairaOf({ value: String(Math.round(Number(amount) * 100)), assetCode: "USD", assetScale: 2 })} at the CBN rate of 16 Nov (₦1,353.97 per $1). The test network runs in dollars.`}
                </p>
              )}
              {error && (
                <div className="status bad" role="alert" style={{ marginTop: "1rem" }}>
                  <p>{error.message}</p>
                  {error.walletSaid && <p className="muted">The wallet said: {error.walletSaid}</p>}
                </div>
              )}
              <button className="wide seller" disabled={busy} style={{ marginTop: "1rem" }}>
                {busy ? "Sending the request…" : "Request payment"}
              </button>
            </form>
          )}

          {data && !view && (
            <aside className="card" aria-labelledby="how-h">
              <h2 id="how-h">What the customer gets</h2>
              <ol className="history">
                <li className="wait">
                  <span className="mark" aria-hidden="true">
                    <Icon name="speaker" size={18} />
                  </span>
                  <div>
                    <p className="title">The request, read aloud</p>
                    <p className="muted">With the exact amount their wallet will send.</p>
                  </div>
                </li>
                <li className="wait">
                  <span className="mark" aria-hidden="true">
                    <Icon name="finger" size={18} />
                  </span>
                  <div>
                    <p className="title">Their fingerprint approves it</p>
                    <p className="muted">Nobody else can approve on their behalf.</p>
                  </div>
                </li>
                <li className="wait">
                  <span className="mark" aria-hidden="true">
                    <Icon name="check" size={18} />
                  </span>
                  <div>
                    <p className="title">You see it arrive</p>
                    <p className="muted">This screen reads the amount from your own wallet.</p>
                  </div>
                </li>
              </ol>
            </aside>
          )}

          {view && (
            <section className="card" aria-labelledby="req-h">
              <h2 id="req-h">Request to customer {view.customerPayCode}</h2>
              <div
                ref={statusRef}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                className={`status ${view.status === "received" ? "good" : view.status === "waiting" ? "wait" : "bad"}`}
              >
                <span className="status-icon">
                  <Icon name={view.status === "received" ? "check" : view.status === "waiting" ? "clock" : "cross"} size={18} />
                </span>
                <p>
                  {STATUS_TEXT[view.status]}
                  {view.reason ? `. ${view.reason}` : ""}
                </p>
              </div>
              <dl className="facts">
                <dt>Asked for</dt>
                <dd>{formatAmount(view.requested)}</dd>
                <dt>Received, as reported by the wallet</dt>
                <dd className="amount">{formatAmount(view.received)}</dd>
              </dl>
              {pollError && <p role="alert">Cannot check the wallet right now: {pollError.message} Still trying.</p>}
              <button className="wide seller" onClick={reset}>
                {view.status === "waiting" ? "Cancel and start a new request" : "New request"}
              </button>
            </section>
          )}
        </div>
        {data && data.history.length > 0 && (
          <section className="card" aria-labelledby="mhist-h">
            <div className="card-head">
              <span className="card-icon seller">
                <Icon name="list" size={22} />
              </span>
              <h2 id="mhist-h">Recent requests</h2>
            </div>
            <p className="muted">Requests made from this app, newest first. Your wallet&apos;s own transaction list is the full record.</p>
            <ol className="history">
              {data.history.map((h) => {
                const good = h.status === "paid";
                const label =
                  h.status === "paid"
                    ? `Paid ${formatAmount(h.receiveAmount ?? h.requested)}`
                    : h.status === "declined"
                      ? "Customer said no"
                      : h.status === "expired"
                        ? "Ran out of time"
                        : h.status === "failed"
                          ? "Not paid"
                          : "In progress";
                return (
                  <li key={h.id} className={good ? "good" : label === "In progress" ? "wait" : "bad"}>
                    <span className="mark" aria-hidden="true">
                      <Icon name={good ? "check" : label === "In progress" ? "clock" : "cross"} size={18} />
                    </span>
                    <div>
                      <p className="title">
                        {label}: asked {h.customerName} ({h.customerPayCode}) for {formatAmount(h.requested)}
                      </p>
                      <p className="muted">
                        <time dateTime={h.at}>
                          {new Date(h.at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </time>
                        {h.reason ? `. ${h.reason}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </main>
    </>
  );
}

/** Reads the customer's pay code QR with the device camera. Falls back to typing if the camera is refused. */
function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");

    (async () => {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (stopped) return;
          if (video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height);
            const m = found ? /^paycode:(\d{6})$/.exec(found.data) : null;
            if (m) return onCode(m[1]);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setProblem("The camera could not be used. Type the six digits instead.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div>
      {problem ? <p role="alert">{problem}</p> : <p role="status">Point the camera at the customer&apos;s code.</p>}
      <video ref={videoRef} className="scan" muted playsInline aria-label="Camera view" />
    </div>
  );
}
