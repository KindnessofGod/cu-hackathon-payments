import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Pay Alone</h1>
      <p>
        A wallet that blind, elderly and non-reading people can operate alone, with no helper holding their card, PIN or phone. Built on Interledger Open
        Payments with test money.
      </p>
      <p>There are two separate apps. Each uses its own wallet address and its own key.</p>
      <div className="card">
        <h2>Seller</h2>
        <p>The shop or POS agent. Ask a customer for a payment and watch it arrive.</p>
        <Link className="button wide" href="/merchant">
          Open the seller app
        </Link>
      </div>
      <div className="card">
        <h2>Customer</h2>
        <p>The person paying. Hear the request, approve it, and stay within a limit you set.</p>
        <Link className="button wide" href="/wallet">
          Open the customer app
        </Link>
      </div>
    </main>
  );
}
