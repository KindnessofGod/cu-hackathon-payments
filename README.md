# Pay Alone: a wallet for people who must operate alone

CU Next Gen Hackathon 2026, Track 2: Inclusive Payments and Financial Access. Built on Interledger Open Payments.

> **Status, 16 Nov 2026:** the full journey runs against a **SIMULATED wallet** only. The real Open Payments client is written but has **not yet been run** against the Interledger test wallet, because the test wallet keys do not exist yet. Nothing below claims a real payment has been made.

## The problem
Blind, elderly and non-reading Nigerians often cannot use their own money alone. Banks refuse cards, and apps and ATMs do not talk, so they hand a card and PIN to a helper. Helpers sometimes steal. See `docs/PITCH_EVIDENCE.md`.

## Who it is for
People who cannot complete a payment on their own today: blind and visually impaired people, elderly people, and people who cannot read.

## The idea
Remove the helper.

- The person approves a spending limit **once** on their wallet's own consent page.
- After that, whoever wants money sends a **request**. The person never types an amount.
- The app reads back the exact amount that will leave the account, taken from the wallet's quote.
- They approve inside the app. The whole screen is one button, so there is nothing to aim at. Doing nothing refuses.
- The **wallet**, not our server, refuses anything over the limit. "Stop everything" cancels the permission.

Voice is the interface only. It never approves money.

## The two apps
One deployment, two separate apps. Each has its own wallet address and its own key. They share no memory; they meet only through Open Payments and the stored payment request.

| App | Path | What it does |
|---|---|---|
| Seller | `/merchant` | Enter the customer's pay code (type it, scan it, or pick a recent customer) and an amount. Creates an incoming payment on the seller's wallet and shows what the wallet reports as received. |
| Customer | `/wallet` | Shows a pay code. Hears each request, approves or refuses it, sets a spending limit, and can stop everything. |

## How Open Payments is used
1. `walletAddress.get` for both wallets (asset code and scale, auth and resource servers).
2. Seller: non-interactive grant, then `incomingPayment.create` with the requested amount and an expiry.
3. Customer: non-interactive grant, then `quote.create` against that incoming payment. Every amount shown or spoken comes from this quote.
4. Consent, one of two ways:
   - **No limit set:** an interactive `outgoing-payment` grant limited to the quote's debit amount. The customer confirms on the wallet's page, and the callback hash is verified before `grant.continue`.
   - **Limit set:** one interactive grant with `limits.debitAmount` and a repeating `interval` (for example `R/2026-11-16T12:00:00Z/P1W`) and no receiver. Later payments need no redirect; the token is rotated when it is close to expiry.
5. `outgoingPayment.create` with the quote id. A payment is only created with a valid approval for that exact quote and amount.
6. The seller app polls its incoming payment. The Open Payments API has no push to clients.
7. "Stop everything" calls `grant.cancel`.

Code: `src/lib/op/real.ts` (the SDK calls), `src/lib/domain.ts` (the journey), `src/lib/approval.ts` (per-payment approval).

## What works today
| Feature | Implemented | Simulated | Planned |
|---|---|---|---|
| Seller requests, customer approves, payment made |  | yes (pretend wallet) | real test wallet: code written, **not yet run** |
| Amounts taken from the quote, integers in minor units | yes |  |  |
| One-time consent on the wallet's page, with callback hash check |  | yes (pretend consent page) | real test wallet |
| Spending limit set once, then approval inside the app |  | yes | real test wallet |
| Wallet refuses a payment over the limit |  | yes (the pretend wallet refuses) | confirm the real wallet enforces it |
| "Stop everything" cancels the permission |  | yes | real test wallet |
| Failure states: unknown pay code, bad amount, expired request, consent refused, over limit, wallet unreachable | yes (screens and handling) | failures triggered on the pretend wallet |  |
| Approval tied to one quote and amount, single use | yes (confirm action) |  | fingerprint passkey signing the same challenge |
| Spoken read-back | placeholder: the device's built-in English voice |  | Spitch / ElevenLabs, Nigerian languages |
| Pay code as QR, six digits, spoken aloud, lock-screen picture | yes |  |  |
| Seller scans the pay code with a camera | written, **not yet tested on a device** |  |  |
| Screen-reader testing (VoiceOver on iPad) |  |  | not done yet |
| Notification on the locked device |  |  | yes |
| Saved people announced in the customer's own recorded voice |  |  | yes |
| Customer starts a payment themselves; spoken commands |  |  | yes |
| USSD / feature-phone access |  |  | yes (not started) |
| Hosted URL and deployed storage |  |  | yes (Vercel and Supabase) |

## Run it locally
Needs Node 20 or newer.

```bash
npm install
```

```bash
npm run dev:mock
```

Open http://localhost:3000. This runs against the **simulated** wallet: a yellow SIMULATED banner shows on every screen and no Open Payments calls are made.

To check the whole journey without clicking, keep the app running and, in a second terminal:

```bash
npm run e2e
```

Unit tests (money, intervals, approval, callback hash):

```bash
npm test
```

### With the real test wallet (not yet verified by us)
1. Create an account at https://wallet.interledger-test.dev (the only real detail needed is an email), add an account with play money, and add two wallet addresses: one for the seller, one for the customer.
2. In Settings > Developer Keys, generate a key for each wallet address. Keep the downloaded `private.key` files out of git.
3. Copy `.env.example` to `.env`, set `MOCK_OP=0`, and fill in the wallet addresses, key ids, keys and `APP_SECRET`.
4. Run `npm run dev`.

## Limitations
- No real payment has been made yet. See the status note at the top.
- The consent page belongs to the wallet provider. We cannot restyle it, and its screen-reader accessibility is untested.
- Approval needs the device unlocked. Nothing can approve money from a locked screen.
- "Left of your limit" is our own record plus what the wallet reports after a payment. It is not an account balance; Open Payments has no balance endpoint.
- Our server holds the spending permission (encrypted at rest). The limit caps what a breach or a trick could cost.
- The app has no login. A device is recognised by a cookie set at setup.
- People without a smartphone or tablet are not covered.
- We assume the public Interledger test wallet is the approved environment; the organizers have not yet confirmed it to us.

## Submitted version
Commit hash: (record at submission time)

## Documents
`docs/BUILD_PROMPT.md` (the build task), `docs/hackathon-participant-guide.md` (rules), `docs/open-payments-technical-findings.md`, `docs/solution-direction-no-helper-wallet.md`, `docs/VOICE_PLAN.md`, `docs/OPEN_ITEMS.md`, `docs/PITCH_EVIDENCE.md`, `DISCLOSURES.md`, `BUILD_LOG.md`, `CLAUDE.md`.
