import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Reveal } from "@/components/landing/Reveal";
import { InkStatement, FingerArt, CallPhone, LimitDial } from "@/components/landing/Art";
import "./landing.css";
import "./landing-sections.css";

const CONTACT = "mailto:kindness@ikangrowthenterprise.com.ng";
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
  {
    k: "plan",
    h: "Next · not built yet",
    items: [
      ["Screen-reader testing", "Not yet done with VoiceOver or TalkBack users."],
      ["Airtime, data and bills", "The same voice and the same approval."],
      ["Subscriptions and shopping online", "Pay any merchant, approved only by you."],
      ["More countries and currencies", "Nigeria first. Then the world."],
    ],
  },
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
            <a href="#two-ways">Approval</a>
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
              Money on your own terms, for people anywhere who can&apos;t see a screen or read. It starts with payments: every request is spoken aloud with the exact amount, and only you can approve it.
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

        <section className="lp-sec problem" aria-labelledby="problem-h">
          <div className="lp-wrap problem-grid">
            <div>
              <p className="kicker">The problem</p>
              <InkStatement id="problem-h" text="The helper was always the risk." accent={["always"]} />
              <p className="sub">
                Around the world, 2.2 billion people live with a vision impairment and 739 million adults lack basic literacy. Many hand over a card and say the PIN aloud so someone else can pay. Pay Alone takes the helper out of the loop.
              </p>
              <p className="src-note">Sources: World Health Organization, World report on vision; UNESCO, 2024.</p>
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
              <p className="sub">The voice reads and listens. Only you can approve a payment, and your wallet enforces your limit.</p>
            </div>
            <div className="bento2">
              <Reveal className="bt limit">
                <p className="lbl">Weekly limit · example</p>
                <LimitDial />
                <p className="big">₦50,000</p>
                <p>You set it once on your own wallet&apos;s page. The wallet, not our server, refuses anything above it.</p>
              </Reveal>
              <Reveal delay={100} className="bt nothing">
                <span className="nothing-ic" aria-hidden="true"><Icon name="clock" size={30} /></span>
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

        <section className="lp-sec status-sec" id="status" aria-labelledby="status-h">
          <div className="lp-wrap">
            <div className="sec-head split-head">
              <div>
                <p className="kicker">Honesty</p>
                <h2 id="status-h">What is real <em>today.</em></h2>
              </div>
              <p className="sub">An early prototype built by one person, starting in Nigeria. Here is what works, and what comes next.</p>
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
              <p className="kicker">Nigeria first. Then the world.</p>
              <h2 id="c">See it for <em>yourself.</em></h2>
              <p>Try the demo in about a minute, or request judge access to unlock live voice.</p>
              <div className="lp-cta">
                <Link href="/demo" className="button lime">Open the demo <Icon name="back" size={20} className="flip" /></Link>
                <Link href="/demo#voice-h" className="button secondary on-dark">Request judge access</Link>
              </div>
            </div>
          </div>
          <footer className="lp-footer2">
            <div className="lp-wrap">
              <div className="foot-row">
                <span>© 2026 iKan Growth Enterprise. Pay Alone.</span>
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
