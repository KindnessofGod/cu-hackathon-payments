"use client";
// Decorative, illustrative art for the landing page. Every piece is aria-hidden or carries its own text;
// nothing here is a recording of the real app, and no real money moves. With Reduce Motion on, it all holds still.
import { useEffect, useRef, useState } from "react";

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => setR(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return r;
}

/** Fires once when the element first scrolls into view. */
function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return setSeen(true);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** A statement whose words ink in as it scrolls up the screen. Screen readers get the plain sentence. */
export function InkStatement({ text, accent = [], id }: { text: string; accent?: string[]; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = useReduced();
  const [p, setP] = useState(1);
  useEffect(() => {
    if (reduced) return setP(1);
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        setP(Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.55))));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [reduced]);
  const words = text.split(" ");
  return (
    <h2 ref={ref} id={id} className="ink" aria-label={text}>
      {words.map((w, k) => (
        <span key={k} aria-hidden="true" className={`${k / words.length < p ? "on" : ""}${accent.includes(w.replace(/[.,]/g, "")) ? " acc" : ""}`}>
          {w}{" "}
        </span>
      ))}
    </h2>
  );
}

/** The fingerprint: ridges draw themselves, then a scan line sweeps over them. */
export function FingerArt() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const ridges = [
    "M50 18c-14 0-26 10-28 24",
    "M78 42c-2-14-14-24-28-24",
    "M32 46c0-10 8-18 18-18s18 8 18 18v6",
    "M41 47c0-5 4-9 9-9s9 4 9 9v10c0 8-3 15-8 20",
    "M50 48v14c0 9-4 17-10 22",
    "M32 56v4c0 10 3 18 8 24",
    "M68 60c0 8-2 15-5 21",
    "M24 52c0 14 4 26 11 34",
    "M77 54c0 10-2 19-6 26",
  ];
  return (
    <div ref={ref} className={`finger-art${seen ? " go" : ""}`} aria-hidden="true">
      <span className="fa-halo" />
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        {ridges.map((d, i) => (<path key={i} d={d} pathLength={1} style={{ transitionDelay: `${i * 90}ms` }} />))}
      </svg>
      <span className="fa-scan" />
      <span className="fa-ok">Approved once · ₦2,500</span>
    </div>
  );
}

/** A basic phone on a call: the amount is said, the PIN is typed on the keypad, never spoken. */
export function CallPhone() {
  const reduced = useReduced();
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [k, setK] = useState(4);
  const SEQ = [2, 7, 5, 9];
  useEffect(() => {
    if (reduced || !seen) return;
    let n = 0;
    const t = setInterval(() => { n = (n + 1) % 7; setK(Math.min(n, 4)); }, 700);
    return () => clearInterval(t);
  }, [reduced, seen]);
  const pressed = k > 0 && k <= 4 ? SEQ[k - 1] : -1;
  return (
    <div ref={ref} className="callphone" aria-hidden="true">
      <div className="cp-body">
        <div className="cp-screen">
          <span className="cp-call"><i /> On a call · 00:41</span>
          <p>Paying <b>₦2,500</b> to Mama Chidi Shop. Type your PIN.</p>
          <div className="cp-dots">{[0, 1, 2, 3].map((d) => (<i key={d} className={d < k ? "on" : ""} />))}</div>
        </div>
        <div className="cp-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((x) => (
            <b key={x} className={String(pressed) === x ? "down" : ""}>{x}</b>
          ))}
        </div>
      </div>
      <span className="cp-nomic">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zm-6-3a6 6 0 0012 0M12 18v3M4 4l16 16" /></svg>
        PIN never spoken
      </span>
    </div>
  );
}

/** A half-circle gauge for the weekly limit example. */
export function LimitDial() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className={`dial${seen ? " go" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 200 110">
        <path d="M20 100a80 80 0 01160 0" className="dial-track" pathLength={1} />
        <path d="M20 100a80 80 0 01160 0" className="dial-fill" pathLength={1} />
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI - (i * Math.PI) / 10;
          return <line key={i} x1={100 + 66 * Math.cos(a)} y1={100 - 66 * Math.sin(a)} x2={100 + 72 * Math.cos(a)} y2={100 - 72 * Math.sin(a)} className="dial-tick" />;
        })}
      </svg>
      <span className="dial-wall">limit</span>
    </div>
  );
}

