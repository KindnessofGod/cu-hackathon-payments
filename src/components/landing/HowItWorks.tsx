"use client";
import { useEffect, useRef, useState } from "react";
import { Scene, type SceneStep } from "./Scene";

const STEPS = [
  { t: "Set a limit once", p: "On your own wallet's page. For example 50,000 naira a week. You do it one time, then you never type an amount again.", s: 0 },
  { t: "The seller asks", p: "They scan your pay code and enter an amount. Nothing moves yet. It is only a request.", s: 0 },
  { t: "You hear it", p: "The exact amount, taken from your wallet's quote, is spoken aloud. Not from the seller, not from the AI.", s: 0 },
  { t: "You approve alone", p: "Touch your fingerprint, or type a keypad PIN on a phone call. Do nothing and it is a no. Over the limit, the wallet refuses.", s: 1 },
] as const;

export function HowItWorks() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setI(Number((e.target as HTMLElement).dataset.i)); }),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  const scene: SceneStep = i === 3 ? 1 : 0;
  return (
    <div className="how">
      <ol className="how-steps">
        {STEPS.map((s, k) => (
          <li key={s.t} ref={(el) => { refs.current[k] = el; }} data-i={k} className={i === k ? "on" : ""}>
            <span className="n">{k + 1}</span>
            <h3>{s.t}</h3>
            <p>{s.p}</p>
          </li>
        ))}
      </ol>
      <div className="how-pin"><Scene step={scene} /></div>
    </div>
  );
}
