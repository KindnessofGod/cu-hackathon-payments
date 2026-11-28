"use client";
// Scroll-driven story: a progress rail on the left fills as you read, the phone on the right follows the step.
import { useEffect, useRef, useState } from "react";
import { Scene, type SceneStep } from "./Scene";

const STEPS: { t: string; p: string; who: string; s: SceneStep }[] = [
  { t: "Set a limit, once.", who: "You, on your wallet", p: "On your own wallet's page, for example 50,000 naira a week. You do it one time, then you never type an amount again.", s: 4 },
  { t: "The seller asks.", who: "The seller", p: "They scan your pay code and enter an amount. Nothing moves. It is only a request.", s: 5 },
  { t: "You hear it.", who: "The app, aloud", p: "The exact amount, taken from your wallet's quote, is spoken aloud. Not from the seller, not from the AI.", s: 0 },
  { t: "You approve, alone.", who: "Only you", p: "Touch your fingerprint, or type a keypad PIN on a phone call. Do nothing and it is a no.", s: 1 },
  { t: "The wallet keeps the line.", who: "Your wallet", p: "Paid, and the receipt is read back. Ask for more than your limit and the wallet itself refuses.", s: 2 },
];

export function HowItWorks() {
  const [i, setI] = useState(0);
  const [fill, setFill] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setI(Number((e.target as HTMLElement).dataset.i)); }),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((r) => r && io.observe(r));
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = list.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const mid = window.innerHeight / 2;
        setFill(Math.min(1, Math.max(0, (mid - r.top) / r.height)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="how2">
      <ol className="how2-steps" ref={list} style={{ ["--fill" as string]: fill }}>
        <span className="how2-rail" aria-hidden="true"><i /></span>
        {STEPS.map((s, k) => (
          <li key={s.t} ref={(el) => { refs.current[k] = el; }} data-i={k} className={i === k ? "on" : i > k ? "past" : ""}>
            <span className="how2-n" aria-hidden="true">{String(k + 1).padStart(2, "0")}</span>
            <p className="how2-who">{s.who}</p>
            <h3>{s.t}</h3>
            <p>{s.p}</p>
          </li>
        ))}
      </ol>
      <div className="how2-pin">
        <div className="how2-stage">
          <span className="how2-glow" aria-hidden="true" />
          <Scene step={STEPS[i].s} decorative />
          <p className="how2-cap" aria-hidden="true">Step {i + 1} of {STEPS.length} · illustration, play money</p>
        </div>
      </div>
    </div>
  );
}
