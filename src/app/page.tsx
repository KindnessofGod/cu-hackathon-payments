import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { Scene } from "@/components/landing/Scene";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Reveal } from "@/components/landing/Reveal";
import "./landing.css";

const CONTACT = "mailto:kindness@ikangrowthenterprise.com.ng";
const RIBBON = ["No helper", "No spoken PIN", "AI never approves", "Your wallet enforces the limit", "Doing nothing means no"];

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

        <div className="ribbon" aria-hidden="true">
          <div className="ribbon-track">
            {[...RIBBON, ...RIBBON, ...RIBBON].map((t, i) => (<span key={i}>{t}<b>✦</b></span>))}
          </div>
        </div>

        <section className="lp-sec" aria-labelledby="problem-h">
          <div className="lp-wrap">
            <Reveal><p className="kicker">The problem</p></Reveal>
            <Reveal><h2 id="problem-h" className="statement">The helper was <em>always</em> the risk.</h2></Reveal>
            <Reveal delay={100}>
              <p className="sub">
                People who cannot see a screen or read numbers often hand over a card and say the PIN aloud to someone else. A swapped card, an overheard PIN, an
                account emptied by someone they trusted. Pay Alone takes the helper out of the loop.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="lp-sec dark" id="how" aria-labelledby="how-h">
          <div className="lp-wrap">
            <Reveal><p className="kicker">How it works</p></Reveal>
            <Reveal><h2 id="how-h">Four steps. Nobody else touches your money.</h2></Reveal>
            <HowItWorks />
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="real-h">
          <div className="lp-wrap">
            <Reveal><p className="kicker">The product</p></Reveal>
            <Reveal><h2 id="real-h">One app to pay. One to get paid.</h2></Reveal>
            <div className="shots">
              <Reveal className="shot-a">
                <figure className="lp-phone"><div className="screen"><Image src="/screens/wallet.webp" width={780} height={1538} alt="The customer app: 50,000 naira left to spend this week, with Say it aloud and Talk buttons." /></div><figcaption><b>Customer</b> hears each request and approves it alone.</figcaption></figure>
              </Reveal>
              <Reveal delay={140} className="shot-b">
                <figure className="lp-phone"><div className="screen"><Image src="/screens/merchant.webp" width={780} height={1538} alt="The seller app: enter the six-digit pay code and an amount, then request payment." /></div><figcaption><b>Seller</b> scans a pay code and asks for an amount.</figcaption></figure>
              </Reveal>
            </div>
            <p className="lp-caption">Screens from the simulated demo, play money.</p>
          </div>
        </section>

        <section className="lp-sec paper" id="two-ways" aria-labelledby="two-h">
          <div className="lp-wrap">
            <Reveal><p className="kicker">Approval</p></Reveal>
            <Reveal><h2 id="two-h">Two ways to approve, for two kinds of phone.</h2></Reveal>
            <div className="lp-two">
              <Reveal>
                <div className="lp-card">
                  <span className="lp-tag">Smartphone app</span>
                  <h3>Your fingerprint.</h3>
                  <p>Hear the request, touch the sensor. Approval is tied to one amount and works once.</p>
                  <div className="fp-art" aria-hidden="true"><i /><i /><i /><Icon name="finger" size={64} /></div>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="lp-card dark">
                  <span className="lp-tag">Any phone, by call · prototype</span>
                  <h3>Keypad PIN, never spoken.</h3>
                  <p>For basic phones. You hear the amount and type your PIN on the keypad. You never say it aloud.</p>
                  <div className="pin-art" aria-hidden="true">
                    <div className="dots"><i /><i /><i /><i /></div>
                    <div className="keys">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (<b key={k} className={`k${k}`}>{k}</b>))}</div>
                    <span className="nomic"><Icon name="mic" size={18} /> never spoken</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="safety" aria-labelledby="safe-h">
          <div className="lp-wrap">
            <Reveal><p className="kicker">Safety</p></Reveal>
            <Reveal><h2 id="safe-h">The AI never moves your money.</h2></Reveal>
            <Reveal delay={80}>
              <ol className="flow">
                <li><span>1</span><b>You speak</b><p>The voice assistant hears you and answers.</p></li>
                <li><span>2</span><b>The wallet quotes</b><p>The exact amount comes from your wallet, not from the AI.</p></li>
                <li className="gate"><span>3</span><b>You approve</b><p>Fingerprint or keypad PIN. Only you. Doing nothing is a no.</p></li>
                <li><span>4</span><b>The wallet enforces</b><p>Over your weekly limit? The wallet refuses.</p></li>
              </ol>
            </Reveal>
            <div className="bento">
              <Reveal className="tile limit">
                <p className="lbl">Weekly limit · example</p>
                <p className="big">₦50,000</p>
                <div className="bar" aria-hidden="true"><i /></div>
                <p>You set it once on your own wallet&apos;s page. The wallet, not our server, refuses anything above it.</p>
              </Reveal>
              <Reveal delay={100} className="tile stop">
                <div className="card-icon"><Icon name="stop" /></div>
                <h3>Stop everything</h3>
                <p>One action cancels the permission.</p>
              </Reveal>
              <Reveal delay={200} className="tile voice">
                <div className="card-icon"><Icon name="speaker" /></div>
                <h3>Voice is only the interface</h3>
                <p>It reads and listens. It cannot approve, pay or confirm.</p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lp-sec paper" id="status" aria-labelledby="status-h">
          <div className="lp-wrap">
            <Reveal><p className="kicker">Honesty</p></Reveal>
            <Reveal><h2 id="status-h">What is real today.</h2></Reveal>
            <p className="sub">Pay Alone is an early prototype built by one person. Here is exactly what works.</p>
            <Reveal>
              <div className="lp-table-wrap">
                <table className="lp-status">
                  <thead><tr><th scope="col">Part</th><th scope="col">Status</th><th scope="col">Note</th></tr></thead>
                  <tbody>
                    <tr><td>Payments, limit and refusal</td><td><span className="lp-badge real">Real, test network</span></td><td>Interledger test wallet, play money.</td></tr>
                    <tr><td>Fingerprint approval</td><td><span className="lp-badge real">Real on one device</span></td><td>Passkey tested on one iPad. Other devices untested.</td></tr>
                    <tr><td>One-device judge demo</td><td><span className="lp-badge sim">Simulated</span></td><td>Pretend wallet so anyone can try it with no setup.</td></tr>
                    <tr><td>Phone-call PIN path</td><td><span className="lp-badge sim">Prototype</span></td><td>Separate build, not in this website&apos;s demo.</td></tr>
                    <tr><td>Live voice in English, Pidgin, Yoruba, Hausa, Igbo</td><td><span className="lp-badge sim">Built, still testing</span></td><td>Wording not yet checked by native speakers.</td></tr>
                    <tr><td>Screen-reader testing</td><td><span className="lp-badge plan">Planned</span></td><td>Not yet done.</td></tr>
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="lp-wrap" id="contact">
          <section className="lp-sec" style={{ paddingBottom: 0 }} aria-labelledby="c">
            <Reveal>
              <div className="lp-final">
                <div className="blob b3" aria-hidden="true" />
                <h2 id="c">See it for yourself.</h2>
                <p>Try the demo in under a minute, or request judge access to unlock live voice. Want a live walkthrough? Email us.</p>
                <div className="lp-cta">
                  <Link href="/demo" className="button">Open the demo</Link>
                  <Link href="/demo#voice-h" className="button secondary">Request judge access</Link>
                </div>
              </div>
            </Reveal>
          </section>
          <footer className="lp-footer">
            <div className="row">
              <span>© 2026 iKan Growth Enterprise. Pay Alone.</span>
              <span><Link href="/wallet">Customer app</Link> · <Link href="/merchant">Seller app</Link> · <a href={CONTACT}>Contact</a></span>
            </div>
            <p style={{ marginTop: "1rem" }}>Interledger test network, play money. Built on Open Payments.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
