import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { Reveal } from "@/components/landing/Reveal";
import "./landing.css";
import "./landing-sections.css";

const CONTACT = "mailto:kindness@ikangrowthenterprise.com.ng";
const STEPS = [
  { t: "Set a weekly limit once", s: "You approve it on your own wallet's page. After that, you never type an amount." },
  { t: "A seller sends a request", s: "They enter your pay code and the amount. Nothing is paid yet." },
  { t: "You hear it and approve", s: "The exact amount is read aloud. You approve with your fingerprint, or say nothing and it's a no." },
] as const;

const SAFETY = [
  { icon: "shield", t: "Your wallet sets the limit", s: "Anything over your weekly limit is refused by the wallet itself." },
  { icon: "clock", t: "Silence means no", s: "If you don't approve, nothing is paid." },
  { icon: "stop", t: "Stop at any time", s: "One action cancels the permission. (Simulated on the test wallet for now.)" },
] as const;

const STATUS: { k: "works" | "proto" | "plan"; name: string; status: string }[] = [
  { k: "works", name: "Payments, weekly limit and refusal", status: "Works · test network" },
  { k: "works", name: "Fingerprint approval", status: "Works · tested on one iPad" },
  { k: "proto", name: "One-device demo", status: "Simulated wallet" },
  { k: "proto", name: "Phone-call PIN path", status: "Prototype · separate build" },
  { k: "proto", name: "Voice in English, Pidgin, Yoruba, Hausa, Igbo", status: "Testing · not checked by native speakers" },
  { k: "plan", name: "Screen-reader testing", status: "Planned" },
];

export default function Home() {
  return (
    <div className="lp">
      <a className="skip" href="#main">Skip to content</a>
      <header className="lp-nav">
        <div className="lp-nav-in">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true"><Icon name="shield" size={20} /></span>
            Pay Alone
          </span>
          <nav className="links" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#approval">Approval</a>
            <a href="#safety">Safety</a>
            <a href="#status">What works</a>
          </nav>
          <div className="nav-actions">
            <Link href="/demo" className="button">Try the demo</Link>
          </div>
        </div>
      </header>

      <main id="main" style={{ maxWidth: "none", padding: 0 }}>
        <section className="lp-hero" aria-labelledby="h">
          <div className="lp-wrap hero-center">
            <span className="lp-pill">Test network · play money · built on Open Payments</span>
            <h1 id="h">
              Pay alone.<br />
              <em>Without a helper.</em>
            </h1>
            <p className="lead">
              A wallet for people who are blind, elderly or can&apos;t read. Every request is spoken aloud with the exact amount. Only you can approve it.
            </p>
            <div className="lp-cta">
              <Link href="/demo" className="button">Try the demo</Link>
              <a href="#how" className="button secondary">See how it works</a>
            </div>
          </div>
          <div className="hero-shots">
            <div className="hero-glow" aria-hidden="true" />
            <div className="phone phone-a">
              <Image src="/screens/customer-app-v6.webp" width={780} height={1538} priority alt="The customer app: money left to spend this week, with Say it aloud and Talk buttons." />
            </div>
            <div className="phone phone-b">
              <Image src="/screens/seller-app-v6.webp" width={780} height={1538} priority alt="The seller app: enter the six-digit pay code and an amount, then request payment." />
            </div>
          </div>
          <p className="lp-caption">Screens from the demo. Play money.</p>
        </section>

        <section className="lp-sec" id="why" aria-labelledby="why-h">
          <div className="lp-wrap">
            <Reveal className="sec-head">
              <p className="label">Why it exists</p>
              <h2 id="why-h">Paying shouldn&apos;t mean handing over your PIN.</h2>
              <p className="sub">Many people who can&apos;t see a screen or read numbers give their card and PIN to someone else to pay for them. Pay Alone lets them pay on their own.</p>
            </Reveal>
          </div>
        </section>

        <section className="lp-sec" id="how" aria-labelledby="how-h">
          <div className="lp-wrap">
            <Reveal className="sec-head">
              <p className="label">How it works</p>
              <h2 id="how-h">Three steps. No helper.</h2>
            </Reveal>
            <Reveal className="cards3">
              {STEPS.map((x, i) => (
                <div className="card-w" key={x.t}>
                  <span className="num" aria-hidden="true">{i + 1}</span>
                  <h3>{x.t}</h3>
                  <p>{x.s}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="lp-sec" id="approval" aria-labelledby="two-h">
          <div className="lp-wrap">
            <Reveal className="sec-head">
              <p className="label">Approval</p>
              <h2 id="two-h">Two ways to approve.</h2>
            </Reveal>
            <Reveal className="cards2">
              <div className="card-w">
                <span className="ic-circle" aria-hidden="true"><Icon name="finger" size={26} /></span>
                <p className="label">Smartphone app</p>
                <h3>Your fingerprint</h3>
                <p>Touch the sensor to approve one payment. Tested with Touch ID on an iPad.</p>
              </div>
              <div className="card-w">
                <span className="ic-circle" aria-hidden="true"><Icon name="mic" size={26} /></span>
                <p className="label">Any phone · prototype</p>
                <h3>A keypad PIN on a call</h3>
                <p>For basic phones. You hear the amount and type your PIN. You never say it aloud.</p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="lp-sec" id="safety" aria-labelledby="safe-h">
          <div className="lp-wrap">
            <Reveal className="sec-head">
              <p className="label">Safety</p>
              <h2 id="safe-h">The AI never moves your money.</h2>
              <p className="sub">The voice reads and listens. Only you can approve a payment, and your wallet enforces your limit.</p>
            </Reveal>
            <Reveal className="items3">
              {SAFETY.map((x) => (
                <div className="item" key={x.t}>
                  <span className="ic-circle" aria-hidden="true"><Icon name={x.icon} size={26} /></span>
                  <h3>{x.t}</h3>
                  <p>{x.s}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="lp-sec" id="status" aria-labelledby="status-h">
          <div className="lp-wrap">
            <Reveal className="sec-head">
              <p className="label">Honest status</p>
              <h2 id="status-h">What works today.</h2>
              <p className="sub">An early prototype built by one person.</p>
            </Reveal>
            <Reveal className="status-card">
              <ul>
                {STATUS.map((r) => (
                  <li key={r.name}>
                    <span className="nm">{r.name}</span>
                    <span className={`st ${r.k}`}><i aria-hidden="true" />{r.status}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="finale" id="contact" aria-labelledby="c">
          <div className="lp-wrap">
            <div className="finale-card">
              <h2 id="c">See it for yourself.</h2>
              <p>The demo takes about a minute. Judges can request live voice.</p>
              <div className="lp-cta">
                <Link href="/demo" className="button lime">Try the demo</Link>
                <Link href="/demo#voice-h" className="button secondary on-dark">Request judge access</Link>
              </div>
            </div>
          </div>
          <footer className="lp-footer2">
            <div className="lp-wrap">
              <div className="foot-row">
                <span>© 2026 iKan Growth Enterprise</span>
                <nav aria-label="Footer"><Link href="/wallet">Customer app</Link><Link href="/merchant">Seller app</Link><Link href="/demo">Demo</Link><a href={CONTACT}>Contact</a></nav>
              </div>
              <p className="foot-note">Interledger test network, play money. The AI never approves, pays or confirms money.</p>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
