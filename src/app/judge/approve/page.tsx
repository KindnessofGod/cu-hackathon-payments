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
    <main className="judge-page">
      <p className="kick">Owner only</p>
      <h1 className="page-title">Judge access</h1>
      <p className="lead">Approving gives one judge live voice for a short window, inside hard limits. Denying keeps the demo touch-only for them.</p>
      {id && sig && (
        <section className="card jcard jfeature" aria-labelledby="this-h">
          <div className="jrow">
            <span className="jface" aria-hidden="true">{(mine?.name ?? "?").slice(0, 1).toUpperCase()}</span>
            <div>
              <h2 id="this-h" className="jname">{mine ? mine.name : "Review this request"}</h2>
              {mine && <p className="jmeta">{mine.competition} · {mine.email}</p>}
            </div>
          </div>
          {mine && <span className={`jstate ${mine.status}`}>{mine.status}</span>}
          <div className="jactions">
            <button onClick={() => void decide(id, "approve", true)}>Approve</button>
            <button className="danger" onClick={() => void decide(id, "deny", true)}>Deny</button>
          </div>
        </section>
      )}
      {msg && <p role="status" className="status good"><span>{msg}</span></p>}
      {locked ? (
        <MerchantKey what="The judge inbox" onDone={() => void load()} />
      ) : (
        rows && (
          <section aria-labelledby="all-h">
            <h2 id="all-h" className="kick" style={{ margin: "2.5rem 0 1rem" }}>All requests · {rows.length}</h2>
            {rows.length === 0 && <p className="muted">No requests yet.</p>}
            {rows.map((r) => (
              <article className="card jcard" key={r.id} aria-label={`Request from ${r.name}`}>
                <div className="jrow">
                  <span className="jface" aria-hidden="true">{r.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <h3 className="jname">{r.name}</h3>
                    <p className="jmeta">{r.competition} · {r.email}</p>
                  </div>
                </div>
                <div className="jusage">
                  <span className={`jstate ${r.status}`}>{r.status}</span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                  {r.usage && <span>live {r.usage.agent} · speak {r.usage.speak} · listen {r.usage.listen}</span>}
                </div>
                <div className="jactions">
                  <button onClick={() => void decide(r.id, "approve", false)}>Approve</button>
                  <button className="danger" onClick={() => void decide(r.id, "deny", false)}>Deny</button>
                </div>
              </article>
            ))}
          </section>
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
