"use client";
import { useState } from "react";
import { api, errorText } from "@/lib/client";

/** Asks once for the merchant key; the server then keeps this device signed in for 90 days. */
/** stage: the studio screen also opens with the stage key (STAGE_KEY), typed here instead of in the link. */
export function MerchantKey({ what, onDone, stage = false }: { what: string; onDone: () => void; stage?: boolean }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (stage) {
        const typed = key.trim();
        const r = await fetch(`/api/stage?key=${encodeURIComponent(typed)}`, { cache: "no-store" });
        if (r.ok) {
          const u = new URL(window.location.href);
          u.searchParams.set("key", typed);
          window.history.replaceState(null, "", u.toString());
          setKey("");
          onDone();
          return;
        }
      }
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
      <h2 style={{ margin: 0 }}>{stage ? "Stage key needed" : "Merchant key needed"}</h2>
      <p className="muted" style={{ margin: 0 }}>{what} is locked so strangers cannot see customers or send them requests. Enter the key once on this device.</p>
      <label htmlFor="mkey">{stage ? "Stage key or merchant key" : "Merchant key"}</label>
      <input id="mkey" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} required />
      {err && <p role="alert" style={{ margin: 0, color: "#b3261e" }}>{err}</p>}
      <button type="submit" disabled={busy || !key}>{busy ? "Checking…" : "Unlock"}</button>
    </form>
  );
}
