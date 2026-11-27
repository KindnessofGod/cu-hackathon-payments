import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import "./landing.css";

const CONTACT = "mailto:kindness@ikangrowthenterprise.com.ng";

export default function Home() {
  return (
    <div className="lp">
      <a className="skip" href="#main">Skip to content</a>
      <header className="lp-nav">
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
      </header>

      <main id="main" style={{ maxWidth: "none", padding: 0 }}>
        <section className="lp-hero" aria-labelledby="h">
          <div className="lp-wrap" style={{ position: "relative" }}>
            <span className="lp-pill">Test network · play money · built on Open Payments</span>
            <h1 id="h">Pay alone.<br /><em>Without a helper.</em></h1>
            <p className="lead">
              A wallet for people who are blind, elderly or cannot read. Every request is spoken aloud with the exact amount. Only you can approve it.
            </p>
            <div className="lp-cta">
              <Link href="/demo" className="button">Try the one-device demo</Link>
              <a href="#how" className="button secondary">See how it works</a>
            </div>
            <div className="lp-stage">
              <div className="lp-bubble hear">
                <small>You hear</small>
                &ldquo;Mama Chidi Shop is asking for 2,500 naira. Touch your fingerprint to pay, or do nothing to say no.&rdquo;
              </div>
              <div className="lp-phone a">
                <div className="screen"><Image src="/screens/wallet.webp" width={780} height={1538} alt="The customer app: weekly limit of 50,000 naira left to spend, with Say it aloud and Talk buttons." priority /></div>
              </div>
              <div className="lp-phone b">
                <div className="screen"><Image src="/screens/merchant.webp" width={780} height={1538} alt="The seller app: enter the customer's six-digit pay code and an amount, then request payment." priority /></div>
              </div>
              <div className="lp-bubble limit">
                <small>Weekly limit</small>
                <span className="big">₦50,000</span>
                Enforced by the wallet, not by us.
              </div>
            </div>
            <p className="lp-caption">Screens from the simulated demo, play money. Example request and amounts are illustrative.</p>
          </div>
        </section>

        <section className="lp-sec" id="how" aria-labelledby="how-h">
          <div className="lp-wrap">
            <h2 id="how-h">The helper was always the risk.</h2>
            <p className="sub">
              People who cannot see a screen or read numbers often hand over a card and say the PIN aloud to someone else. Swapped cards, shared PINs and
              overdrawn accounts follow. Pay Alone removes the helper.
            </p>
            <ol className="lp-steps">
              <li><span className="n">1</span><h3>Set a limit once</h3><p>On your own wallet&apos;s page. For example 50,000 naira a week.</p></li>
              <li><span className="n">2</span><h3>The seller asks</h3><p>They scan your pay code and enter an amount.</p></li>
              <li><span className="n">3</span><h3>You hear it</h3><p>The exact amount, taken from your wallet&apos;s quote.</p></li>
              <li><span className="n">4</span><h3>You approve</h3><p>Fingerprint, or a keypad PIN on a call. Over the limit, the wallet says no.</p></li>
            </ol>
          </div>
        </section>

        <section className="lp-sec paper" id="two-ways" aria-labelledby="two-h">
          <div className="lp-wrap">
            <h2 id="two-h">Two ways to approve, for two kinds of phone.</h2>
            <div className="lp-two">
              <div className="lp-card">
                <span className="lp-tag">Smartphone app</span>
                <h3>Your fingerprint.</h3>
                <p>Hear the request, touch the sensor. Approval is tied to one amount and works once.</p>
                <ul><li>Voice guides every step</li><li>Large buttons, high contrast</li><li>Works with screen readers</li></ul>
                <div className="lp-fp" aria-hidden="true"><Icon name="finger" size={56} /></div>
              </div>
              <div className="lp-card dark">
                <span className="lp-tag">Any phone, by call · prototype</span>
                <h3>Keypad PIN, never spoken.</h3>
                <p>For basic phones. You hear the amount and type your PIN on the keypad. You never say it aloud.</p>
                <ul><li>No smartphone or data needed</li><li>Separate prototype, not in the website demo</li></ul>
                <div className="lp-keys" aria-hidden="true"><b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>6</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="safety" aria-labelledby="safe-h">
          <div className="lp-wrap">
            <h2 id="safe-h">The AI never moves your money.</h2>
            <div className="lp-safe">
              <div><div className="card-icon"><Icon name="speaker" /></div><h3>Voice is only the interface</h3><p>It reads and listens. It cannot approve, pay or confirm a payment.</p></div>
              <div><div className="card-icon"><Icon name="shield" /></div><h3>Limits enforced by the wallet</h3><p>Not by our server. Anything over your weekly limit is refused by the wallet itself.</p></div>
              <div><div className="card-icon"><Icon name="stop" /></div><h3>Stop everything</h3><p>One action cancels the permission. Doing nothing on a request means no.</p></div>
            </div>
          </div>
        </section>

        <section className="lp-sec paper" id="status" aria-labelledby="status-h">
          <div className="lp-wrap">
            <h2 id="status-h">What is real today, honestly.</h2>
            <p className="sub">Pay Alone is an early prototype built by one person. Here is exactly what works.</p>
            <div className="lp-table-wrap">
              <table className="lp-status">
                <thead><tr><th scope="col">Part</th><th scope="col">Status</th><th scope="col">Note</th></tr></thead>
                <tbody>
                  <tr><td>Payments, limit and refusal</td><td><span className="lp-badge real">Real, test network</span></td><td>Interledger test wallet, play money.</td></tr>
                  <tr><td>Fingerprint approval</td><td><span className="lp-badge real">Real on one device</span></td><td>Passkey tested on one iPad. Other devices untested.</td></tr>
                  <tr><td>One-device judge demo</td><td><span className="lp-badge sim">Simulated</span></td><td>Pretend wallet so anyone can try it with no setup.</td></tr>
                  <tr><td>Phone-call PIN path</td><td><span className="lp-badge sim">Prototype</span></td><td>Separate build, not in this website&apos;s demo.</td></tr>
                  <tr><td>Screen-reader testing, native-speaker checks</td><td><span className="lp-badge plan">Planned</span></td><td>Not yet done.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="lp-wrap" id="contact">
          <section className="lp-sec" style={{ paddingBottom: 0 }} aria-labelledby="c">
            <div className="lp-final">
              <h2 id="c">See it for yourself.</h2>
              <p>Try the demo in under a minute, or request judge access to unlock live voice. Want a live walkthrough? Email us.</p>
              <div className="lp-cta">
                <Link href="/demo" className="button">Open the demo</Link>
                <Link href="/demo#voice-h" className="button secondary">Request judge access</Link>
              </div>
            </div>
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
