# BUILD PROMPT: Open Payments demo for the CU Next Gen Hackathon 2026

You are the builder agent. Read this whole file, then `CLAUDE.md`, then the three context docs listed in "Read first". Work on a branch, commit often, and keep `BUILD_LOG.md` current.

## 0. The situation in six lines

- Competition: CU Next Gen Hackathon 2026 (Covenant University), built on Interledger **Open Payments**. Track 2: Inclusive Payments and Financial Access.
- **Submission deadline: Wednesday 18 Nov 2026, 5:00 PM WAT.** Today is Monday 16 Nov. Plan for finishing build by Tuesday night, with Wednesday morning for the demo video and submission.
- The builder (Agbo Kindness, a final-year student, student budget, iPad and Windows PC, no Mac) needs a **working, honest demo**, not a slide deck.
- Product vision: a wallet that blind, elderly and non-reading people operate alone, with no helper. Voice and fingerprint come later. **Right now the job is the core payment transaction, app to app, done properly with Open Payments.** Voice is icing and must be planned for, not built yet.
- Rubric: inclusion impact 30%, Open Payments integration 25%, prototype execution 20%, usability and accessibility 15%, originality 10%.
- Rule that overrides everything: **never fake data or results.** Anything simulated must be labelled simulated in the UI, the README and the video.

## 1. Read first (in this order)

1. `docs/hackathon-participant-guide.md`: the organizers' rules, dates, submission items, judging.
2. `docs/open-payments-technical-findings.md`: how Open Payments works (grants, limits, tokens, what the API cannot do) and six unconfirmed items.
3. `docs/solution-direction-no-helper-wallet.md`: the product direction and design decisions.
4. `docs/VOICE_PLAN.md`: how voice plugs in later (interface only for now).
5. `docs/OPEN_ITEMS.md`: unknowns to resolve or ask organizers.

## 2. Scope: what to build now

### Stage 1 (must ship, target: working by Tuesday midday): one payment, app to app

Two separate surfaces, each with its **own wallet address and its own developer key**:

- **Receiver app (`/merchant`)**, the shop or POS agent. Enter an amount, press "Request payment". The server creates an **incoming payment** on the receiver's wallet and shows a **payment code** (short code plus QR) that points to that incoming payment. It then polls the incoming payment and shows live status: waiting, received, expired or failed. Show the amount received as reported by the wallet, not as typed.
- **Payer app (`/wallet`)**, the customer. Enter or scan the code. The server fetches the incoming payment, creates a **quote** on the payer's wallet, and shows the exact amount leaving the payer's account (fees included) and the amount arriving. The payer approves. The server requests an **interactive outgoing-payment grant** (redirect to the wallet's own consent page), handles the callback, **continues the grant**, creates the **outgoing payment**, and shows the final result and the receiver's confirmation.

Must handle and show clearly: payment amounts, currency/asset, user authorization, transaction status, and **at least these failures**: expired or invalid code, quote failure, grant rejected by the user, payment exceeding the grant limit, and wallet unreachable. A judge must be able to see each failure state.

Definition of done for Stage 1: from a clean browser, a judge follows the README, makes a payment from the payer wallet to the receiver wallet on the test network, and sees matching amounts on both apps and in both wallets' transaction lists.

### Stage 2 (if Stage 1 is solid, target: Tuesday night): the "set once, approve in-app" model

This is the core of the no-helper product and the strongest Open Payments story:

1. **Setup once.** Payer sets a spending cap and interval (for example NGN or the available test asset: 20,000 per week). Server requests an outgoing-payment grant with `limits` (`debitAmount`, `interval` as ISO 8601 repeating interval, for example `R/2026-11-16T00:00:00Z/P1W`) and **no receiver**. User approves once on the wallet's consent page. Server stores the grant's continue/manage details **server-side only**.
2. **Every payment after that**: code scanned, quote created, server states the exact debit amount, the payer **approves inside our app** (no redirect), server rotates the token if expired, creates the outgoing payment under the standing grant.
3. **Approval step** is a stub interface now (`ApprovalProvider`): a confirm button. Later it becomes a WebAuthn passkey (fingerprint) bound to the quote id and amount. Design the API so a payment cannot be created without a valid approval object for that quote.
4. **Over-cap payment**: try a payment above the remaining limit and show the wallet refusing it. This is the demo moment that proves the standing cap is enforced by the wallet, not by us.
5. **Stop everything**: a button that cancels the grant (`grant.cancel`) and shows the next payment failing.

If the test wallet does not enforce the interval or limit as the docs say, **report it plainly in the README and the log**; do not fake an enforcement screen.

### Stage 3 (plan for it, do not build yet): voice and passkey

Build only the seams listed in `docs/VOICE_PLAN.md`: a `SpeechOutput` interface with a browser `speechSynthesis` placeholder, a `SpeechInput` interface that is a no-op, and a `ApprovalProvider` interface. No Spitch, no ElevenLabs, no WebAuthn until Stages 1 and 2 are demonstrably working.

### Out of scope

Real money, real banks, USSD, balance reads (the API has no balance endpoint), webhooks to the client (none; poll instead), building our own wallet or Rafiki unless organizers say the public test wallet is not approved.

## 3. Open Payments technical brief

Facts below come from the project's research doc. Items marked **verify** must be checked against the current docs before you rely on them: https://openpayments.dev , https://openpayments.guide , and the official snippets repo https://github.com/interledger/open-payments-snippets . If code you write disagrees with this file, trust the current docs and write down the difference in `BUILD_LOG.md`.

**Resources:** wallet address (a URL), incoming payment (receiver's wallet), quote (sender's wallet), outgoing payment (sender's wallet). Each resource call needs an access token obtained through a **grant** from the wallet's authorization server.

**Flow for one payment (sketch, verify each call and field name in the SDK types):**

1. Get both wallet addresses: `client.walletAddress.get({ url })`. The result includes `id`, `authServer`, `resourceServer`, `assetCode`, `assetScale`.
2. Receiver side: request a non-interactive grant for `incoming-payment` (`create`, `read`, `complete`), then `client.incomingPayment.create(...)` with `walletAddress` and an optional `incomingAmount`.
3. Payer side: non-interactive grant for `quote` (`create`, `read`), then `client.quote.create(...)` with the incoming payment as `receiver` and `method: 'ilp'`. Read exact `debitAmount` and `receiveAmount` from the quote. **The amount shown to the user must come from the quote.** The test wallet deducts a small fee on outgoing payments.
4. Payer approval: request an `outgoing-payment` grant with `interact: { start: ['redirect'], finish: { method: 'redirect', uri: <our callback>, nonce } }`. For the one-time model set `limits.debitAmount` from the quote. For the standing model set `limits` with `debitAmount` and `interval`, and no receiver. Outgoing grants **must be interactive**; redirect is the only start mode.
5. Redirect the user to `interact.redirect`. The wallet shows its own consent page. The user approves. The wallet redirects to our callback with `hash` and `interact_ref`. **Verify the hash** per the spec, then `client.grant.continue(...)` with the `interact_ref` to get the access token.
6. `client.outgoingPayment.create(...)` with `quoteId` (or the documented shape) using that token.
7. Poll the incoming payment on the receiver side and the outgoing payment on the payer side until completed or failed.

**Facts to design around:**

- The consent page belongs to the wallet provider. We cannot restyle or replace it. Its screen-reader accessibility is untested; test it and report.
- Amounts are strings in minor units with `assetCode` and `assetScale`. Never use floating point for money. Format for display from `assetScale`.
- Access tokens last about 10 minutes by default. Store the token's `manage` URL and rotate (`client.token.rotate`) before use. Tokens and keys never reach the browser.
- Limits are maxima per interval. Unspent amounts do not roll over.
- `incomingPayment.list` and `list-all` may require interaction. Do not depend on listing payments you did not create.
- No balance endpoint and no client webhooks. "How much is left" means "left of the cap" computed from our own record plus what the wallet reports; label it that way.
- Requests are signed with Ed25519. Generate keys in the test wallet under Settings > Developer Keys, download the private key, base64 or PEM per the SDK docs. **verify** the exact key format `createAuthenticatedClient` expects.
- Node SDK: `@interledger/open-payments` with `createAuthenticatedClient({ walletAddressUrl, privateKey, keyId })`. Pin the version in `package.json`.

## 4. Recommended stack (you may deviate if you write why in `BUILD_LOG.md`)

- TypeScript, Node 20+, **Next.js (App Router)**, deployed to **Vercel** (HTTPS is needed for the wallet callback, and later for WebAuthn). Open Payments calls run only in server code (route handlers).
- One repo, one deployment, **two clearly separate apps** (`/merchant`, `/wallet`) that use **different wallet addresses and different keys**, so a judge sees one app paying another. Each has its own simple layout. The two apps must not share in-memory state; they communicate only through Open Payments and the stored payment record.
- Storage behind a small `Store` interface: SQLite file for local dev; a hosted Postgres (Supabase free tier) or Upstash Redis for the deployed demo, because serverless instances do not keep memory. Store grant continue tokens and manage URLs server-side, encrypted at rest if feasible; never log them.
- Secrets only in environment variables. Provide `.env.example`; real `.env` is git-ignored. **A key or token in git history disqualifies trust**: if one is ever committed, say so and rotate it.
- Accessibility from the start: semantic HTML, labels on every control, focus order, large touch targets, `aria-live` regions for status changes, no information conveyed by colour alone. Test with a screen reader (VoiceOver on iPad, TalkBack on Android) and write down what you found.

## 5. Human tasks you cannot do (ask the user, do not fake)

1. Create **two** test wallet accounts at https://wallet.interledger-test.dev (sender and receiver), complete fake KYC, create an account in an available asset, deposit play money, create a wallet address for each.
2. In each wallet, Settings > Developer Keys: create a key pair; keep the private key out of git; give you the **key id** and put the private key in `.env` / Vercel env.
3. Confirm with the organizers (Telegram) whether the public test wallet is the approved environment. Until then assume yes and say so in the README.
4. Provide a Vercel account link and, later, Spitch / ElevenLabs API keys.

If these are not available when you start, build the whole app against a **clearly labelled mock Open Payments server** (`MOCK_OP=1`, banner "SIMULATED" on every screen) so the UI, states and failure handling are ready, then switch to the real wallet the moment keys exist. The mock must never be presented as the real integration.

## 6. Competition compliance checklist (build these into the repo)

- [ ] README has: problem, users, track, how Open Payments is used, setup, **one-command local run**, hosted URL, test instructions with test wallet steps, limitations.
- [ ] README has a table **Implemented / Simulated / Planned**, kept honest.
- [ ] `DISCLOSURES.md`: AI assistance (Claude was used to write code), prior work, dependencies and licences.
- [ ] `BUILD_LOG.md`: dated log of what was built when (the competition build window opened after the Sunday 15 Nov onboarding call).
- [ ] Commit hash of the submitted version recorded in the README at submission time; after submission, Hacker House improvements go on a new branch/tag and the original stays intact.
- [ ] No keys, tokens, passwords or personal data in the repo, screenshots, logs or video.
- [ ] Demo video script in `docs/DEMO_SCRIPT.md`, max 3 minutes: user problem (20 s), working app-to-app payment on the test network (90 s), failure and cap enforcement (40 s), what is simulated or planned (20 s), next steps (10 s).
- [ ] A judge can reproduce the demo from the README without asking us anything.

## 7. Working rules

- Work in small vertical slices. First slice: **`walletAddress.get` for both wallets and print asset codes**, to prove keys and connectivity. Second: incoming payment created and visible in the receiver wallet. Third: quote. Fourth: grant redirect round-trip. Fifth: outgoing payment. Only then UI polish.
- After each slice, run it for real against the test wallet and paste the outcome (without secrets) into `BUILD_LOG.md`.
- When something is wrong with the docs, the wallet, or the API, do not paper over it. Add it to `docs/OPEN_ITEMS.md` with what you tried and the exact error.
- Prefer boring and reliable over clever. The demo must survive venue Wi-Fi: add retries with timeouts, visible loading states, and a recorded backup video of a successful run.
- Tests: unit tests for money formatting and limit arithmetic; one integration script that runs the happy path against the test wallet (`npm run e2e`), skipped when keys are missing.
- Do not add dependencies casually; each one goes in `DISCLOSURES.md`.
- Ask the user only for the human tasks above or a real product decision. Otherwise choose, write the choice in `BUILD_LOG.md`, and continue.

## 8. Timeline

| When (WAT) | Target |
|---|---|
| Mon 16 Nov evening | Repo scaffold, mock mode, both apps' screens, keys obtained, `walletAddress.get` working |
| Tue 17 Nov morning | Stage 1 end to end on the real test wallet |
| Tue 17 Nov midday | Failure states, README, deployed on Vercel, record backup video |
| Tue 17 Nov night | Stage 2 (standing cap, over-cap refusal, stop everything), interfaces for voice and passkey |
| Wed 18 Nov morning | Freeze code, final demo video, fill submission items, record commit hash |
| Wed 18 Nov before 5:00 PM | **Submit.** Aim to submit by 3:00 PM. |

## 9. Final report format

When you stop, write a short status into `BUILD_LOG.md`: what works (with evidence), what is simulated, what is planned, what failed and why, exact commit hash, and the three riskiest things before the demo.
