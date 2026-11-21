"use client";
import { useState } from "react";
import { api, errorText } from "@/lib/client";

/** Asks once for the merchant key; the server then keeps this device signed in for 90 days. */
export function MerchantKey({ what, onDone }: { what: string; onDone: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/merchant/login", { method: "POST", body: { key } });
      setKey("");
      onDone();
    } catch (x) {
      setErr(errorText(x).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={go} className="card" style={{ display: "grid", gap: "0.8rem", maxWidth: "28rem" }}>
      <h2 style={{ margin: 0 }}>Merchant key needed</h2>
      <p className="muted" style={{ margin: 0 }}>{what} is locked so strangers cannot see customers or send them requests. Enter the key once on this device.</p>
      <label htmlFor="mkey">Merchant key</label>
      <input id="mkey" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} required />
      {err && <p role="alert" style={{ margin: 0, color: "#b3261e" }}>{err}</p>}
      <button type="submit" disabled={busy || !key}>{busy ? "Checking…" : "Unlock"}</button>
    </form>
  );
}
