import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { Scene } from "@/components/landing/Scene";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Reveal } from "@/components/landing/Reveal";
import { InkStatement, FingerArt, CallPhone, Boundary, LimitDial, Countdown, Tilt } from "@/components/landing/Art";
import "./landing.css";
import "./landing-sections.css";

const CONTACT = "mailto:kindness@ikangrowthenterprise.com.ng";
const PROMISES = [
  { icon: "person", t: "No helper", s: "You do it alone" },
  { icon: "mic", t: "No spoken PIN", s: "Keypad or fingerprint" },
  { icon: "speaker", t: "AI never approves", s: "It only reads and listens" },
  { icon: "shield", t: "Wallet enforces the limit", s: "Not our server" },
  { icon: "clock", t: "Doing nothing means no", s: "Silence never pays" },
] as const;

const STATUS: { k: string; h: string; items: [string, string][] }[] = [
  {
    k: "real",
    h: "Works today, test network",
    items: [
      ["Payments, limit and refusal", "Interledger test wallet, play money."],
      ["Fingerprint approval", "Passkey tested on one iPad. Other devices untested."],
    ],
  },
  {
    k: "sim",
    h: "Simulated or prototype",
    items: [
      ["One-device judge demo", "Pretend wallet so anyone can try it with no setup."],
      ["Phone-call PIN path", "Separate prototype, not in this website's demo."],
      ["Live voice in English, Pidgin, Yoruba, Hausa, Igbo", "Built, still testing. Wording not yet checked by native speakers."],
    ],
  },
  { k: "plan", h: "Planned", items: [["Screen-reader testing", "Not yet done with VoiceOver or TalkBack users."]] },
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
            <a href="#two-ways">Two ways to approve</a>
            <a href="#safety">Safety</a>
            <a href="#status">What is real</a>
          </nav>
          <div className="nav-actions">
            <Link href="/demo#voice-h" className="button secondary ghost">Request judge access</Link>
            <Link href="/demo" className="button">Try the demo</Link>
          </div>
        </div>
      </header>

      <main id="main" style={{ maxWidth: "none", padding: 0 }}>
        <section className="lp-hero" aria-labelledby="h">
          <div className="blob b1" aria-hidden="true" /><div className="blob b2" aria-hidden="true" />
          <div className="lp-wrap hero-grid">
            <div className="hero-copy">
              <span className="lp-pill"><i aria-hidden="true" /> Test network · play money · built on Open Payments</span>
              <h1 id="h">
                <span className="line"><span>Pay alone.</span></span>
                <span className="line"><span><em>Without a helper.</em></span></span>
              </h1>
              <p className="lead">
                A wallet for people who are blind, elderly or cannot read. Every request is spoken aloud with the exact amount. Only you can approve it.
              </p>
              <div className="lp-cta">
                <Link href="/demo" className="button">Try the one-device demo <Icon name="back" size={20} className="flip" /></Link>
                <a href="#how" className="button secondary">See how it works</a>
              </div>
              <ul className="hero-proof">
                <li>Fingerprint in the app</li>
                <li>Keypad PIN on a call</li>
                <li>Never a spoken PIN</li>
              </ul>
            </div>
            <div className="hero-art">
              <Scene auto />
              <div className="chip-float c1" aria-hidden="true"><Icon name="speaker" size={18} /> Voice only reads and listens</div>
              <div className="chip-float c2" aria-hidden="true"><Icon name="shield" size={18} /> The wallet enforces your limit</div>
            </div>
          </div>
          <p className="lp-caption">Animation is illustrative. Names and amounts are examples, play money.</p>
        </section>

        <section className="promises" aria-label="Five promises">
          <ul className="lp-wrap promise-row">
            {PROMISES.map((p, i) => (
              <li key={p.t} style={{ ["--i" as string]: i }}>
                <span className="pr-ic"><Icon name={p.icon} size={22} /></span>
                <b>{p.t}</b>
                <span>{p.s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-sec problem" aria-labelledby="problem-h">
          <div className="lp-wrap problem-grid">
            <div>
              <p className="kicker">The problem</p>
              <InkStatement id="problem-h" text="The helper was always the risk." accent={["always"]} />
              <p className="sub">
                People who cannot see a screen or read numbers often hand over a card and say the PIN aloud to someone else. Pay Alone takes the helper out of the loop.
              </p>
            </div>
            <ul className="risks" aria-label="What can go wrong with a helper">
              <li className="r1"><span className="risk-n">A</span><b>A swapped card</b><span>Handed over at a counter or an ATM, and a different card comes back.</span></li>
              <li className="r2"><span className="risk-n">B</span><b>An overheard PIN</b><span>Said aloud so someone else can type it. Now more than one person knows it.</span></li>
              <li className="r3"><span className="risk-n">C</span><b>An emptied account</b><span>Drained by someone who was trusted to help.</span></li>
            </ul>
          </div>
        </section>

        <section className="lp-sec dark how-sec" id="how" aria-labelledby="how-h">
          <div className="grain" aria-hidden="true" />
          <div className="lp-wrap">
            <div className="sec-head">
              <p className="kicker">How it works</p>
              <h2 id="how-h">Five moments. <em>Nobody else</em> touches your money.</h2>
            </div>
            <HowItWorks />
          </div>
        </section>

        <section className="lp-sec" id="two-ways" aria-labelledby="two-h">
          <div className="lp-wrap">
            <div className="sec-head split-head">
              <div>
                <p className="kicker">Approval</p>
                <h2 id="two-h">Two ways to say yes. <em>Both only yours.</em></h2>
              </div>
              <p className="sub">A smartphone app for people who have one. A plain phone call for people who do not. Neither one ever asks you to say a secret aloud.</p>
            </div>
            <div className="diptych">
              <Reveal className="dip light">
                <div className="dip-copy">
                  <span className="lp-tag">01 · Smartphone app</span>
                  <h3>Your fingerprint.</h3>
                  <p>Hear the request, touch the sensor. Each approval is tied to one amount and works once.</p>
                  <ul className="ticks"><li>Built and live in the web demo</li><li>Tested with Touch ID on one iPad</li></ul>
                </div>
                <FingerArt />
              </Reveal>
              <Reveal delay={120} className="dip dark">
                <div className="dip-copy">
                  <span className="lp-tag">02 · Any phone, by call · prototype</span>
                  <h3>Keypad PIN. Never spoken.</h3>
                  <p>For basic phones. You hear the amount, then type your PIN on the keypad. You never say it aloud.</p>
                  <ul className="ticks"><li>Separate prototype, not in this website&apos;s demo</li></ul>
                </div>
                <CallPhone />
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lp-sec paper safety" id="safety" aria-labelledby="safe-h">
          <div className="lp-wrap">
            <div className="sec-head center">
              <p className="kicker">Safety</p>
              <h2 id="safe-h">The AI never moves <em>your money.</em></h2>
              <p className="sub">There is a hard line between what the voice can do and what only you and your wallet can do. Nothing crosses it.</p>
            </div>
            <Boundary />
            <div className="bento2">
              <Reveal className="bt limit">
                <p className="lbl">Weekly limit · example</p>
                <LimitDial />
                <p className="big">₦50,000</p>
                <p>You set it once on your own wallet&apos;s page. The wallet, not our server, refuses anything above it.</p>
              </Reveal>
              <Reveal delay={100} className="bt nothing">
                <Countdown />
                <h3>Doing nothing means no.</h3>
                <p>The whole screen is one button. If you do not approve, nothing is paid.</p>
              </Reveal>
              <Reveal delay={200} className="bt stop">
                <span className="stop-btn" aria-hidden="true"><Icon name="stop" size={30} /></span>
                <h3>Stop everything.</h3>
                <p>One action cancels the permission you gave. On the test wallet this part is still simulated.</p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lp-sec product" aria-labelledby="real-h">
          <div className="lp-wrap">
            <div className="sec-head split-head">
              <div>
                <p className="kicker">The product</p>
                <h2 id="real-h">One app to pay. <em>One to get paid.</em></h2>
              </div>
              <p className="sub">Both run in a browser. The customer app is built for listening first; the seller app is built for speed at a busy counter.</p>
            </div>
            <Tilt className="stage-shots">
              <figure className="dev dev-a">
                <div className="dev-screen"><Image src="/screens/customer-app.webp" width={780} height={1538} alt="The customer app: money left to spend this week, with Say it aloud and Talk buttons." /></div>
                <figcaption><b>Customer</b> hears each request and approves it alone.</figcaption>
              </figure>
              <figure className="dev dev-b">
                <div className="dev-screen"><Image src="/screens/seller-app.webp" width={780} height={1538} alt="The seller app: enter the six-digit pay code and an amount, then request payment." /></div>
                <figcaption><b>Seller</b> enters a pay code and asks for an amount.</figcaption>
              </figure>
              <span className="callout k1" aria-hidden="true"><i />Every amount comes from the wallet&apos;s quote</span>
              <span className="callout k2" aria-hidden="true"><i />A pay code cannot take money</span>
            </Tilt>
            <p className="lp-caption">Screens from the simulated demo, play money.</p>
          </div>
        </section>

        <section className="lp-sec status-sec" id="status" aria-labelledby="status-h">
          <div className="lp-wrap">
            <div className="sec-head split-head">
              <div>
                <p className="kicker">Honesty</p>
                <h2 id="status-h">What is real <em>today.</em></h2>
              </div>
              <p className="sub">Pay Alone is an early prototype built by one person. Here is exactly what works, and what does not yet.</p>
            </div>
            <div className="board3">
              {STATUS.map((col) => (
                <Reveal key={col.h} className={`col ${col.k}`}>
                  <h3><span className="col-dot" aria-hidden="true" />{col.h}</h3>
                  <ul>
                    {col.items.map(([t, n]) => (<li key={t}><b>{t}</b><span>{n}</span></li>))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="finale" id="contact" aria-labelledby="c">
          <div className="lp-wrap">
            <div className="finale-card">
              <div className="finale-glow" aria-hidden="true" />
              <p className="kicker">Try it</p>
              <h2 id="c">See it for <em>yourself.</em></h2>
              <p>Try the demo in under a minute, or request judge access to unlock live voice. Want a live walkthrough? Email us.</p>
              <div className="lp-cta">
                <Link href="/demo" className="button lime">Open the demo <Icon name="back" size={20} className="flip" /></Link>
                <Link href="/demo#voice-h" className="button secondary on-dark">Request judge access</Link>
              </div>
            </div>
          </div>
          <footer className="lp-footer2">
            <div className="lp-wrap">
              <p className="wordmark-xl" aria-hidden="true">Pay alone.</p>
              <div className="foot-row">
                <span>© 2026 iKan Growth Enterprise. Pay Alone.</span>
                <nav aria-label="Footer"><Link href="/wallet">Customer app</Link><Link href="/merchant">Seller app</Link><Link href="/demo">Demo</Link><a href={CONTACT}>Contact</a></nav>
              </div>
              <p className="foot-note">Interledger test network, play money. Built on Open Payments. The voice assistant never approves, pays or confirms money.</p>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
