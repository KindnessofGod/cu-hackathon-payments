import Link from "next/link";
import { Icon } from "@/components/ui";
import "./landing.css";

const CONTACT = "mailto:kindness@ikangrowthenterprise.com.ng";

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="lp-nav">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true"><Icon name="shield" size={20} /></span>
          Pay Alone
        </span>
        <nav className="links" aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#two-ways">Two ways to approve</a>
          <a href="#status">What is real today</a>
          <a href="#contact">Contact</a>
        </nav>
        <Link href="/demo" className="button nav-cta">Try the demo</Link>
      </header>

      <main id="main" style={{ maxWidth: "none", padding: 0 }}>
        <div className="lp-wrap">
          <section className="lp-hero" aria-labelledby="h">
            <div>
              <span className="eyebrow">Open Payments · test network</span>
              <h1 id="h">Pay with your own hands. No helper holding your PIN.</h1>
              <p className="lead">
                Pay Alone lets blind, elderly and non-reading people pay and get paid on their own. Every request is read aloud with the exact
                amount. Only you can approve it.
              </p>
              <div className="lp-cta">
                <Link href="/demo" className="button">Try the one-device demo</Link>
                <a href="#how" className="button secondary">See how it works</a>
              </div>
              <p className="lp-note">Interledger test network. Play money only, no real money moves.</p>
            </div>
            <div className="lp-phone" aria-label="Example of what the customer hears and sees">
              <span className="label">Example request</span>
              <div className="amount">₦2,500</div>
              <p>&ldquo;Tunde&apos;s Shop is asking for 2,500 naira. Touch your fingerprint to pay, or do nothing to refuse.&rdquo;</p>
              <div className="fake-btn"><Icon name="finger" size={26} /> Approve with fingerprint</div>
            </div>
          </section>
        </div>

        <section className="lp-sec alt" id="problem">
          <div className="lp-wrap">
            <h2>Today, paying means trusting someone else with your money.</h2>
            <p className="lead">
              People who cannot see a screen or read numbers often hand over a card and say the PIN out loud to a helper at the ATM or the shop.
              That helper is the risk: swapped cards, shared PINs, overdrawn accounts. Pay Alone removes the helper.
            </p>
          </div>
        </section>

        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <h2>How it works</h2>
            <ol className="steps" style={{ marginTop: "1.5rem" }}>
              <li><strong>Set a limit once</strong><p className="muted">On your own wallet&apos;s page, for example 50 a week.</p></li>
              <li><strong>The seller asks</strong><p className="muted">They scan your pay code and enter an amount.</p></li>
              <li><strong>You hear it</strong><p className="muted">The exact amount leaving your account, taken from your wallet&apos;s quote.</p></li>
              <li><strong>You approve alone</strong><p className="muted">Fingerprint, or a keypad PIN on a phone call. Over the limit, your wallet says no.</p></li>
            </ol>
          </div>
        </section>

        <section className="lp-sec alt" id="two-ways">
          <div className="lp-wrap">
            <h2>Two ways to approve, for two kinds of phone</h2>
            <div className="lp-grid c2">
              <div className="card lp-path">
                <span className="tag">Smartphone app</span>
                <h3>Fingerprint approval</h3>
                <p>Open the app, hear the request, touch your fingerprint. Approval is tied to one amount and works once.</p>
                <ul className="lp-list"><li>Voice guides every step</li><li>Large buttons, high contrast</li><li>Works with screen readers</li></ul>
              </div>
              <div className="card lp-path phone">
                <span className="tag">Any phone, by call</span>
                <h3>Keypad PIN, never spoken</h3>
                <p>For basic phones. You are called, you hear the amount, and you type your PIN on the keypad. You never say it aloud.</p>
                <ul className="lp-list"><li>No smartphone or data needed</li><li>PIN tones are not heard by the voice assistant</li><li>Prototype, shown separately</li></ul>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="safety">
          <div className="lp-wrap">
            <h2>Built so the AI can never move your money</h2>
            <div className="lp-grid c3">
              <div className="card"><div className="card-icon"><Icon name="speaker" /></div><h3>Voice is only the interface</h3><p className="muted">The voice reads and listens. It never approves, pays or confirms a payment.</p></div>
              <div className="card"><div className="card-icon"><Icon name="shield" /></div><h3>Limits enforced by the wallet</h3><p className="muted">Not by our server. Anything over your weekly limit is refused by the wallet itself.</p></div>
              <div className="card"><div className="card-icon"><Icon name="stop" /></div><h3>Stop everything</h3><p className="muted">One action cancels the permission. Doing nothing on a request means no.</p></div>
            </div>
          </div>
        </section>

        <section className="lp-sec alt" id="status">
          <div className="lp-wrap">
            <h2>What is real today, honestly</h2>
            <p className="lead">Pay Alone is an early prototype built by one person. We say exactly what works.</p>
            <div style={{ overflowX: "auto" }}>
              <table className="lp-status">
                <thead><tr><th scope="col">Part</th><th scope="col">Status</th><th scope="col">Note</th></tr></thead>
                <tbody>
                  <tr><td>Payments, limit and refusal</td><td><span className="lp-badge real">Real, test network</span></td><td>Interledger test wallet, play money.</td></tr>
                  <tr><td>Fingerprint approval</td><td><span className="lp-badge real">Real on tested device</span></td><td>Passkey tested on one iPad. Other devices untested.</td></tr>
                  <tr><td>One-device judge demo</td><td><span className="lp-badge sim">Simulated</span></td><td>Pretend wallet so anyone can try it without setup.</td></tr>
                  <tr><td>Phone-call PIN path</td><td><span className="lp-badge sim">Prototype</span></td><td>Separate build, not in this website&apos;s demo.</td></tr>
                  <tr><td>Screen-reader testing, native-speaker checks</td><td><span className="lp-badge plan">Planned</span></td><td>Not yet done.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="lp-wrap" id="contact">
          <section className="lp-final" aria-labelledby="c">
            <h2 id="c">See it for yourself</h2>
            <p>Try the demo in under a minute, or request judge access to unlock live voice. Want a live walkthrough? Email us.</p>
            <div className="lp-cta">
              <Link href="/demo" className="button">Open the demo</Link>
              <Link href="/demo#voice-h" className="button secondary">Request judge access</Link>
            </div>
          </section>
          <footer className="lp-footer">
            <div className="row">
              <span>© 2026 iKan Growth Enterprise. Pay Alone.</span>
              <span><Link href="/wallet">Customer app</Link> · <Link href="/merchant">Seller app</Link> · <a href={CONTACT}>Contact</a></span>
            </div>
            <p style={{ marginTop: "1rem" }}>Test network, play money. Built on Open Payments.</p>
          </footer>
        </div>
      </main>
    </>
  );
}
