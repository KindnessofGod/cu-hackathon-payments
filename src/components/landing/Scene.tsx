"use client";
// Illustrative animation of one payment, drawn in HTML/CSS. Not a recording of the real app, and no real money moves.
import { useEffect, useState } from "react";

export type SceneStep = 0 | 1 | 2 | 3 | 4 | 5;
const COPY: Record<SceneStep, { tag: string; line: string }> = {
  0: { tag: "1 · The request", line: "Mama Chidi Shop is asking for 2,500 naira." },
  1: { tag: "2 · You approve", line: "Touch your fingerprint to pay, or do nothing to say no." },
  2: { tag: "3 · Done", line: "Paid 2,500 naira to Mama Chidi Shop." },
  3: { tag: "Over the limit", line: "Refused by the wallet. That is more than your weekly limit." },
  4: { tag: "Set once · on your wallet", line: "Your weekly limit, approved on your own wallet's page." },
  5: { tag: "A seller asks", line: "Mama Chidi Shop sent a request. Nothing has moved yet." },
};

const SCENE_LABEL =
  "Animated example of one payment: the request is spoken aloud, the person approves with a fingerprint, and the payment completes. A second example shows the wallet refusing an amount over the weekly limit. Play money.";

function Wave({ live }: { live: boolean }) {
  return (
    <span className={`wave${live ? " live" : ""}`} aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i * 67) % 900}ms`, height: `${22 + ((i * 37) % 60)}%` }} />
      ))}
    </span>
  );
}

export function Scene({ step, auto = false, decorative = false }: { step?: SceneStep; auto?: boolean; decorative?: boolean }) {
  const [n, setN] = useState<SceneStep>(step ?? 0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (step !== undefined) setN(step);
  }, [step]);
  useEffect(() => {
    if (!auto || still) return;
    const t = setInterval(() => setN((s) => ((s + 1) % 4) as SceneStep), 3400);
    return () => clearInterval(t);
  }, [auto, still]);
  const cur = still && auto ? 1 : n;
  const c = COPY[cur as SceneStep];
  return (
    <div className="scene" {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": SCENE_LABEL })}>
      <div className="scene-phone" aria-hidden="true">
        <div className="scene-notch" />
        <div className={`scene-screen s${cur}`}>
          <div className="scene-top">
            <span className="scene-dot" /> Pay Alone <em>demo · play money</em>
          </div>
          <div className="scene-tag" key={`t${cur}`}>{c.tag}</div>
          <div className="scene-amt" key={`a${cur}`}>{cur === 3 ? "₦60,000" : cur === 4 ? "₦50,000" : "₦2,500"}</div>
          <p className="scene-line" key={`l${cur}`}>{c.line}</p>
          <div className="scene-stage">
            {cur === 0 && (<><Wave live /><span className="scene-cap">Speaking aloud…</span></>)}
            {cur === 1 && (
              <span className="scene-fp"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11a5 5 0 0110 0v2M12 11v6M9 13v3a3 3 0 002 3M15 13v2a6 6 0 01-1 3M5 9a7 7 0 0114 0M4.5 15a9 9 0 001 3" /></svg><i /><i /></span>
            )}
            {cur === 2 && (<span className="scene-ok"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path className="tick" d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>)}
            {cur === 4 && (<span className="scene-lock"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zm-3 9l2 2 4-4" /></svg><small>a week</small></span>)}
            {cur === 5 && (<span className="scene-req"><b>Mama Chidi Shop</b><i /><i /><i /></span>)}
            {cur === 3 && (<span className="scene-no"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></span>)}
          </div>
          <div className="scene-meter"><span style={{ width: cur === 2 ? "5%" : cur === 3 ? "5%" : "0%" }} /></div>
          <div className="scene-foot">{cur === 3 ? "Limit ₦50,000 a week · nothing was paid" : cur === 5 ? "Waiting for you · nothing paid yet" : "Limit ₦50,000 a week"}</div>
        </div>
      </div>
      {!decorative && <div className="scene-dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (<b key={i} className={cur === i ? "on" : ""} />))}
      </div>}
    </div>
  );
}
