# Build log

Dated entries, newest last. Record what was built, what was run against the real test wallet (no secrets), decisions with reasons, and failures with exact errors.

## 2026-11-16
- Repo created with context docs and the build prompt. No application code yet.

- 2026-11-16: Added Matt Pocock agent skills (MIT) under `.claude/skills/` as development tooling for the AI assistant. No app code yet.
- 2026-11-16: Ran the skills setup: local markdown tickets in `.scratch/`, default triage labels, single-context domain docs (`docs/agents/`).
- 2026-11-16: Design settled with the owner: one journey (the receiver always requests, the customer approves); pay code as QR / six digits / lock-screen picture; whole-screen approval, doing nothing refuses; spending limit is core, not optional. Native iPad app dropped (no Mac; a free Apple account cannot use push). Web app added to the Home Screen instead.
- 2026-11-16: Research. The Interledger test wallet is self-serve: sign up, fake KYC, Settings > Developer Keys, a `private.key` file downloads (source: openpayments.dev/sdk/before-you-begin). NGN availability not confirmed. This cloud session could not reach the test wallet hosts until a project environment allowing them was approved.
- 2026-11-16: Stack as recommended (Next.js App Router, TypeScript). Deviations: storage is one JSON-document table behind a `Store` interface, with a JSON file locally instead of SQLite (fewer moving parts); Postgres for the deployed app.
- 2026-11-16: Built: money module (integer minor units), payments gateway interface with a real implementation (official SDK 7.4.0) and a SIMULATED one, request / quote / approval / limit / stop logic, seller app, customer app, simulated consent page.
- 2026-11-16: Ran against the SIMULATED wallet only (`npm run e2e`, 19 checks, all passed; also driven through both screens in headless Chromium). This proves our own code paths. It is not evidence about Open Payments or the test wallet.
- 2026-11-16: NOT yet done: any call to the real test wallet (no keys yet). The first real slice is `walletAddress.get` for both wallets.

### Status at end of this entry
- Works (simulated wallet only): request, quote, one-time consent, limit set once, in-app approval, over-limit refusal, stop everything, refusal and bad-input states.
- Simulated: the wallet, its 1% fee, its limit enforcement, its consent page.
- Planned: real test wallet run, deployment, fingerprint passkey, voice labels, lock-screen notification, provider voices.
- Riskiest things before the demo: (1) the real wallet's behaviour is untested, including whether it enforces the interval limit and what error it returns; (2) passkeys and notifications inside a Home Screen web app on iPadOS are untested; (3) the rules require two students per team.
- 2026-11-16 (evening): Owner created the test wallet and two wallet addresses. First real call: a plain GET on each wallet address from this session (no keys needed). Result:
  - `https://ilp.interledger-test.dev/gloria-customer`: publicName "Gloria", assetCode USD, assetScale 2. Role: customer (payer).
  - `https://ilp.interledger-test.dev/mamachris-customer`: publicName "Mama Chris", assetCode USD, assetScale 2. Role: seller (receiver).
  - Both report the same authServer and resourceServer (same test wallet tenant). Asset is USD, so the demo runs in USD, not naira; the UI formats from the wallet's own assetCode.
  - Not yet tested: anything that needs keys (grants, incoming payment, quote, outgoing payment).
- 2026-11-16 (evening): Owner generated one developer key per wallet address. Checked each key ID against the wallet's public `jwks.json`: each wallet publishes exactly one Ed25519 key, and its kid matches the key ID the owner gave for it. Wallet addresses and key IDs added to the Vercel project's environment. Private keys are entered by the owner directly in Vercel; this session never sees them.
- 2026-11-16 (night): Deployed to Vercel at https://pay-alone.vercel.app with simulated mode OFF, storage on a new Supabase Postgres project. Two deploy fixes:
  - The private keys in Vercel were not in full PEM form, so the key loader now also accepts the bare middle line, PEM with lost line breaks, and base64 of the file (unit-tested with a generated Ed25519 key; the real keys were never seen by this session).
  - The SDK reads its OpenAPI spec files from disk at runtime; Vercel left them out (`ENOENT .../openapi/specs/wallet-address-server.yaml`). Fixed with `outputFileTracingIncludes` in `next.config.ts`.
- 2026-11-16 (night): REAL test wallet, via the deployed app (`/api/health`, then `npm run e2e` against the production URL):
  - Signed `walletAddress.get` with each app's own key: both resolve (Mama Chris and Gloria, USD, scale 2).
  - Seller: non-interactive incoming-payment grant and `incomingPayment.create` for USD 1.00 succeeded.
  - Customer: non-interactive quote grant and `quote.create` succeeded: debitAmount USD 100 (scale 2), receiveAmount USD 100. No fee between these two addresses on the same test wallet account (the research doc expected a small fee; not seen here).
  - Interactive outgoing-payment grant request succeeded and returned a consent redirect on the wallet's site.
  - NOT yet done: a person approving on the consent page, `grant.continue`, and `outgoingPayment.create`. That needs the owner in a browser.
  - The test customer and request this script created were deleted from the database afterwards.
- 2026-11-16 21:47 WAT: **First real payment on the Interledger test wallet**, done by the owner in a browser on https://pay-alone.vercel.app.
  - Seller (Mama Chris) requested USD 1.00. Customer (Gloria) app quoted debit USD 1.00 / receive USD 1.00, approval on the in-app screen, then one-time consent on the test wallet's own consent page.
  - Callback hash verified, `grant.continue` returned a token, `outgoingPayment.create` succeeded (request status `paid`, outgoing payment id stored).
  - Independent check from the seller side: the seller app re-read the incoming payment from Mama Chris's wallet: receivedAmount USD 100 (scale 2), status received.
  - Still to confirm by eye: the payment appears in both wallets' transaction lists on wallet.interledger-test.dev.
- 2026-11-17 04:58 WAT: **Spending limit on the real test wallet.** Owner set a USD 5.00 weekly limit (one consent on the wallet's page, interval `R/2026-11-16T20:52:33Z/P1W`, no receiver).
  - Request for USD 7.00: the wallet **refused** `outgoingPayment.create` with HTTP 403, code/description "unauthorized". It gave no reason. The app rotated the token once and retried; refused again. By our own record the payment would exceed the limit, so the app says the wallet refused and that, by our record, it is over the limit. We do not claim the wallet said "limit".
  - Request for USD 2.00 at 04:59: paid **inside the app with no redirect**, under the standing grant. Left of limit by our record: USD 3.00.
  - Open item: the `grantSpentDebitAmount` the wallet returned with that payment was 0, which does not match. Meaning unclear (maybe the amount before this payment). The app no longer displays it.
- 2026-11-17: Added history on both apps (payments through this app only; the wallet's transaction list is the full record), with a spoken summary of the last three on the customer side.
- 2026-11-17: Privacy fix: the seller was being shown the customer's own failure text, which could include the customer's limit. The seller now sees only neutral reasons ("the customer's wallet did not make this payment").
- 2026-11-17: Fingerprint approval (WebAuthn passkey). Setup on the customer screen; once on, every payment needs a fingerprint signature over that request's approval challenge (bound to request, quote and amount). A tap-only approval is refused by the server. The fingerprint cannot be removed from the app. Tested in headless Chromium with a virtual platform authenticator: setup, refusal of a tap-only proof, payment with the fingerprint, and no payment when the finger check fails. Not yet tried on the iPad's Touch ID or inside a Home Screen web app.
- 2026-11-17: Read the owner's voice test repo (KindnessofGod/ai-voice-demo) and summarised its findings into `docs/VOICE_PLAN.md`.
- 2026-11-17: Hosted voice for the customer app: the request read-back, the payment result and "what is left" in English, Pidgin, Yoruba, Igbo or Hausa. The server builds each sentence from its own records (the browser only names which sentence); amounts are said in English inside every language. Routing from the owner's voice test: Spitch for Igbo, ElevenLabs for the rest, the other as backup, and the device's built-in English voice if nothing plays within 4 seconds. Checked on production with a throwaway 1-cent request: all five languages returned MP3 audio (Igbo from Spitch, the rest from ElevenLabs); the request was then declined and the test records deleted. Not yet listened to by a human; non-English wording written by Claude, not checked by a native speaker.
- 2026-11-17: Disclosure wording corrected with the owner: the voice test repo was built in the build window (first timed log entry Sun 15 Nov 14:16 WAT, after the onboarding call), so it is listed as companion work, not prior work.
- 2026-11-17: UI redesign of both apps: app bar with a role badge (Customer / Seller), start page with the two roles and how it works, pay code beside its QR, spending-limit meter (with a text label, not colour alone), icons on every status, collapsible voice settings, and a calmer full-screen approval. No behaviour changes; simulated journey, unit tests and fingerprint test re-run and passing.
