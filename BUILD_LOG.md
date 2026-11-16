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
