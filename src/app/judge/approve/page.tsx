"use client";
// The owner's one-tap review page. Opened from the alert link (which carries a signature) or, with the merchant
// key, as an inbox of all requests. Approving gives that judge a short window of live voice inside hard caps.
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppBar } from "@/components/ui";
import { MerchantKey } from "@/components/MerchantKey";
import { api, errorText } from "@/lib/client";

type Row = { id: string; name: string; email: string; competition: string; createdAt: string; status: string; expiresAt?: string; usage?: { agent: number; speak: number; listen: number } };

function Review() {
  const q = useSearchParams();
  const id = q.get("id") ?? "";
  const sig = q.get("sig") ?? "";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setRows((await api<{ requests: Row[] }>("/api/judge/inbox")).requests);
      setLocked(false);
    } catch {
      setLocked(true);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function decide(rowId: string, decision: "approve" | "deny", withSig: boolean) {
    setMsg("");
    try {
      await api("/api/judge/decide", { method: "POST", body: { id: rowId, decision, ...(withSig ? { sig } : {}) } });
      setMsg(decision === "approve" ? "Approved. The judge's page unlocks voice within seconds." : "Denied.");
      void load();
    } catch (e) {
      setMsg(errorText(e).message);
    }
  }

  const mine = rows?.find((r) => r.id === id);
  return (
    <main>
      <h1>Judge access</h1>
      {id && sig && (
        <div className="card">
          <h2>{mine ? `${mine.name}, ${mine.competition}` : "Review this request"}</h2>
          {mine && <p className="muted">{mine.email} · status: {mine.status}</p>}
          <button className="wide" onClick={() => void decide(id, "approve", true)}>Approve</button>
          <button className="wide danger" onClick={() => void decide(id, "deny", true)}>Deny</button>
        </div>
      )}
      {msg && <p role="status" className="status good"><span>{msg}</span></p>}
      {locked ? (
        <MerchantKey what="The judge inbox" onDone={() => void load()} />
      ) : (
        rows && (
          <>
            <h2>All requests</h2>
            {rows.length === 0 && <p className="muted">No requests yet.</p>}
            {rows.map((r) => (
              <div className="card" key={r.id}>
                <strong>{r.name}</strong> · {r.competition}
                <p className="muted">{r.email} · {new Date(r.createdAt).toLocaleString()} · {r.status}{r.usage ? ` · live ${r.usage.agent}, speak ${r.usage.speak}, listen ${r.usage.listen}` : ""}</p>
                <div className="chips">
                  <button onClick={() => void decide(r.id, "approve", false)}>Approve</button>
                  <button className="danger" onClick={() => void decide(r.id, "deny", false)}>Deny</button>
                </div>
              </div>
            ))}
          </>
        )
      )}
    </main>
  );
}

export default function Page() {
  return (
    <>
      <AppBar />
      <Suspense fallback={<main><p>Loading…</p></main>}>
        <Review />
      </Suspense>
    </>
  );
}
