import Link from "next/link";
import { AppBar, Icon } from "@/components/ui";

export default function Home() {
  return (
    <>
      <AppBar />
      <main>
        <section className="hero">
          <span className="eyebrow">Open Payments · test network</span>
          <h1>Pay and get paid alone, with no helper holding your card or PIN.</h1>
          <p className="lead">
            For blind, elderly and non-reading people. Every request is read aloud with the exact amount, approved with your fingerprint, and capped by a weekly
            limit that your wallet enforces.
          </p>
        </section>

        <Link href="/demo" className="card role-card" style={{ borderColor: "var(--brand)", marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Judges: try it on one device</h2>
          <p className="muted">A customer and a seller side by side, a limit already set, no setup. Simulated wallet, play money.</p>
          <span className="button wide">Open the one-device demo</span>
        </Link>

        <div className="grid-2">
          <Link href="/wallet" className="card role-card">
            <span className="card-icon">
              <Icon name="person" />
            </span>
            <h2>I am paying</h2>
            <p className="muted">Hear each request, approve it with your fingerprint, and stay within the limit you set.</p>
            <span className="button wide">Open the customer app</span>
          </Link>
          <Link href="/merchant" className="card role-card">
            <span className="card-icon seller">
              <Icon name="shop" />
            </span>
            <h2>I am selling</h2>
            <p className="muted">Scan the customer&apos;s pay code, ask for an amount, and watch the payment arrive.</p>
            <span className="button wide seller" style={{ background: "var(--seller)", borderColor: "var(--seller)" }}>
              Open the seller app
            </span>
          </Link>
        </div>

        <h2 style={{ marginTop: "2rem" }}>How it works</h2>
        <ol className="steps">
          <li>
            <strong>Set a limit once</strong>
            <p className="muted">On your own wallet&apos;s page, for example 50 a week.</p>
          </li>
          <li>
            <strong>The seller asks</strong>
            <p className="muted">They scan your pay code and enter an amount.</p>
          </li>
          <li>
            <strong>You hear it</strong>
            <p className="muted">The exact amount leaving your account, from your wallet&apos;s quote.</p>
          </li>
          <li>
            <strong>You approve alone</strong>
            <p className="muted">Fingerprint on the Home button. Over the limit, your wallet says no.</p>
          </li>
        </ol>
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          Two separate apps, each with its own wallet address and key. Test money only.
        </p>
      </main>
    </>
  );
}
