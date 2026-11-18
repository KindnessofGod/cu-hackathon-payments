# Pay Alone: a wallet for people who must operate alone

CU Next Gen Hackathon 2026, Track 2: Inclusive Payments and Financial Access. Built on Interledger Open Payments.

> **Status, 17 Nov 2026, night:** on the Interledger test wallet, through the hosted app: a one-time payment with consent on the wallet's page, a weekly spending limit set once, payments approved inside the app under that limit (including with Touch ID on an iPad), and the wallet refusing a payment over it. The customer can talk about a request by voice in five languages. "Stop everything" has so far run only against the SIMULATED wallet. The native iPad app is built and installs, but iPadOS has not yet let it open (see Limitations).

Hosted: https://payalone.vercel.app (seller: `/merchant`, customer: `/wallet`).

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
| Seller requests, customer approves, payment made | yes, on the real test wallet (one-time consent) | also runs on the pretend wallet |  |
| Amounts taken from the quote, integers in minor units | yes |  |  |
| One-time consent on the wallet's page, with callback hash check | yes, on the real test wallet |  |  |
| Spending limit set once, then approval inside the app | yes, on the real test wallet |  |  |
| Wallet refuses a payment over the limit | yes, on the real test wallet (it answers 403 "unauthorized" without a reason; the app explains it from its own record) |  |  |
| "Stop everything" cancels the permission |  | yes | real test wallet |
| Failure states: unknown pay code, bad amount, expired request, consent refused, over limit, wallet unreachable | yes (screens and handling) | failures triggered on the pretend wallet |  |
| Approval tied to one quote and amount, single use | yes |  |  |
| Fingerprint approval on the website (WebAuthn passkey, Touch ID) | yes: once set up, every payment needs it and a tap alone is refused. **Paid for real on the owner's iPad Air 3 with Touch ID** (17 Nov). iPadOS shows its own passkey sheet first; a website cannot skip it |  |  |
| Native iPad app with instant Touch ID (`ios/`) | written: a thin native shell whose Secure Enclave key, usable only after Touch ID, signs each approval; the server verifies it. Built in the cloud and **installed on the owner's iPad with a free Apple ID, but iPadOS's "Verify App" step has not succeeded yet**, so it has not opened. A bare test app fails the same way, so the block is the certificate check, not this app's code |  |  |
| Spoken read-back of requests, results and what is left | yes: ElevenLabs (English, Pidgin, Yoruba, Hausa) and Spitch (Igbo), with the device's English voice as fallback. Non-English wording **not yet checked by a native speaker** |  |  |
| **One live voice, "Talk to Pay Alone"**: a natural conversation any time (Nigerian voice, can be interrupted). Ask what is left of the limit, what was spent, who was paid and when, the pay code, how the app works; talk through a seller's request and pay or refuse it; **send money by voice** to someone paid before ("send five hundred to Mama Chidi") | yes, built 18 Nov: one ElevenLabs agent (real-time, WebRTC; language model Gemini 2.5 Flash run by ElevenLabs). It gets only this customer's records and the wallet's quote, and is told to use nothing else and to say "paid" only when the wallet confirmed it. Its tools prepare a payment (incoming payment on the receiver's wallet with a non-interactive grant, then the wallet's quote) and open the fingerprint prompt; **only the fingerprint approves** (or a tap when no fingerprint is set up). It does not know the wallet balance (no Open Payments endpoint). A moving orb shows who is talking. English, Pidgin (spoken by the English agent), Yoruba, Hausa; **Igbo is not supported by ElevenLabs Agents**, so Igbo users get English. Sending tested in simulated mode; the live call not yet tested on the iPad at the time of writing. If it cannot start, the app falls back to the row below |  |  |
| Fallback voice answers: ask "who is this?", "how much is left?", "say again", "help"; answer "pay" or "no" (any of the five languages) | yes: Spitch (Yoruba, Igbo, Hausa) or ElevenLabs (English, Pidgin) turns the answer into text. "pay" only opens the fingerprint prompt; "no" refuses; the app answers questions from its own records and keeps listening; anything it cannot understand twice ends the conversation. Starts without a tap inside the iPad app. Tested on production with the app's own recorded sentences, not yet with a human voice on the iPad |  |  |
| Other spoken commands (hear history, read the pay code) |  |  | yes |
| Pay code as QR, six digits, spoken aloud, lock-screen picture | yes |  |  |
| Payment history on both apps, spoken summary for the customer | yes (payments through this app only) |  |  |
| Seller scans the pay code with a camera | written, **not yet tested on a device** |  |  |
| Screen-reader testing (VoiceOver on iPad) |  |  | not done yet |
| Notification on the locked device |  |  | yes |
| Saved people announced in the customer's own recorded voice |  |  | yes |
| Customer starts a payment themselves; spoken commands |  |  | yes |
| USSD / feature-phone access |  |  | yes (not started) |
| Hosted URL and deployed storage | yes (Vercel and Supabase) |  |  |

## Try it (judges)
**Hosted, real test wallet:** open https://payalone.vercel.app/merchant (seller) on one device and https://payalone.vercel.app/wallet (customer) on another, for example a laptop and a phone or tablet.
1. Customer: set up the device (the customer wallet address is filled in). Note the six-digit pay code.
2. Seller: type the pay code and an amount such as 0.01, and send.
3. Customer: the request fills the screen. Tap once: it is read aloud, then the app listens. Ask "who is this?" or "how much is left?", then say "pay" (or tap twice) or "no". Allow the microphone when asked.
4. With no spending limit, the payment goes to the wallet's own consent page. That page needs the test wallet account that owns the customer address, so a judge cannot finish this step on the hosted demo; the 3-minute video shows it, and `BUILD_LOG.md` records each real run. To run every step yourself with your own test wallet, use the local setup below with your own keys.

**Simulated, every step, no accounts:** the local setup below with `npm run dev:mock`. A yellow SIMULATED banner shows on every screen.

The demo script is in `docs/DEMO_SCRIPT.md`.

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

## The native iPad app (optional, for the live demo)
The website is the prototype judges can reproduce. For the live demo there is also a small native iPad app in `ios/`, so the fingerprint is Apple's ordinary Touch ID prompt instead of the website passkey sheet. It is built without a Mac on GitHub's macOS runners (`.github/workflows/ios.yml`, unsigned) and installed with Sideloadly using a free Apple ID (the app then runs for 7 days). It loads the same hosted app; only the fingerprint step differs.

## Limitations
- The native iPad app has not opened on the owner's iPad: iPadOS's online "Verify App" check for the free developer certificate fails on the owner's mobile connection (also with a VPN, after a network reset, and for a bare test app). It will be retried on Wi-Fi. The website version does everything the app does except the plain Touch ID prompt and the no-tap start.
- The live voice is a language model: it can misspeak. Mitigations: it only receives the quote's amounts, the screen always shows the exact amount, and only the fingerprint approves. Conversation audio goes to ElevenLabs.
- Fallback voice answers are matched against short word lists per language (written by Claude, not checked by a native speaker). Only answers of nine words or fewer count; "pay" opens the fingerprint prompt and never pays by itself.
- When the wallet refuses a payment over the limit it does not say why (HTTP 403 "unauthorized"). The app's "over your limit" explanation comes from its own record.
- History shows only payments made through this app.
- The consent page belongs to the wallet provider. We cannot restyle it, and its screen-reader accessibility is untested.
- Approval needs the device unlocked. Nothing can approve money from a locked screen.
- The fingerprint is any finger enrolled on the device. If someone else's finger is enrolled on the same iPad, they can approve too.
- Once the fingerprint is on it cannot be turned off from the app, so someone holding the unlocked device cannot remove it. "Forget this device" starts over without the spending limit, which brings back the wallet's own consent page for every payment.
- "Left of your limit" is our own record plus what the wallet reports after a payment. It is not an account balance; Open Payments has no balance endpoint.
- Our server holds the spending permission (encrypted at rest). The limit caps what a breach or a trick could cost.
- The app has no login. A device is recognised by a cookie set at setup.
- People without a smartphone or tablet are not covered.
- We assume the public Interledger test wallet is the approved environment; the organizers have not yet confirmed it to us.

## Submitted version
Commit hash: (record at submission time)

## Documents
`docs/BUILD_PROMPT.md` (the build task), `docs/hackathon-participant-guide.md` (rules), `docs/open-payments-technical-findings.md`, `docs/solution-direction-no-helper-wallet.md`, `docs/VOICE_PLAN.md`, `docs/OPEN_ITEMS.md`, `docs/PITCH_EVIDENCE.md`, `DISCLOSURES.md`, `BUILD_LOG.md`, `CLAUDE.md`.
