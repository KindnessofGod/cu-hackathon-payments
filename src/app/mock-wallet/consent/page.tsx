"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/client";
import { formatAmount, type Amount } from "@/lib/money";

interface Info {
  walletAddress: string;
  limits: { debitAmount: Amount; interval?: string };
}

// SIMULATED consent page. The real one belongs to the wallet provider and cannot be restyled by us.
export default function MockConsent() {
  const [grant, setGrant] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("grant") ?? "";
    setGrant(id);
    api<Info>(`/api/mock-wallet/consent?grant=${encodeURIComponent(id)}`).then(setInfo, (e) => setError(errorText(e).message));
  }, []);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { redirectUrl } = await api<{ redirectUrl: string }>("/api/mock-wallet/consent", { method: "POST", body: { grant, approve } });
      window.location.assign(redirectUrl);
    } catch (e) {
      setError(errorText(e).message);
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Pretend wallet: give permission</h1>
      <p className="muted">This page stands in for the wallet provider&apos;s own consent page while the app runs in simulated mode.</p>
      {error && (
        <p role="alert" className="status bad">
          {error}
        </p>
      )}
      {info && (
        <div className="card">
          <p>Pay Alone is asking for permission to pay from:</p>
          <p>
            <strong>{info.walletAddress}</strong>
          </p>
          <p className="amount">Up to {formatAmount(info.limits.debitAmount)}</p>
          <p>{info.limits.interval ? `Repeating: ${info.limits.interval}` : "For one payment only."}</p>
          <button className="wide" disabled={busy} onClick={() => decide(true)}>
            Allow
          </button>
          <button className="wide secondary" disabled={busy} onClick={() => decide(false)}>
            Refuse
          </button>
        </div>
      )}
    </main>
  );
}
