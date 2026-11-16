# Open Payments: technical findings for the "no helper" wallet

Researched 14 Nov 2026 from the Open Payments and Rafiki documentation (links at the bottom). Nothing here has been run yet. Items under "Not confirmed" must be tested on the test wallet or asked of the organizers.

## Goal this research serves
A blind, elderly or non-reading person sends, pays and receives money entirely on their own, with no third party handling their card, PIN or phone.

## What the docs confirm

### 1. One approval can cover many future payments
- An outgoing-payment grant can be requested with a spending limit and a repeating interval, with no recipient named. The docs' own guide: up to $100 CAD a month for three months; the amount resets each interval and unspent amounts do not roll over.
- Limits are maxima: many payments can be created under one grant as long as their total stays within the limit for the interval.
- `limits` fields: `debitAmount` (max leaving the payer), `receiveAmount` (max arriving), `interval` (ISO 8601 repeating interval, e.g. `R3/2025-05-20T13:00:00Z/P1M`). Amounts are `{ value, assetCode, assetScale }`, value in minor units as a string.
- Consequence for us: the user approves on the wallet's page ONCE at setup. After that every payment is approved inside our app (voice read-back plus fingerprint) with no redirect.

### 2. Consent is always on the wallet provider's side
- Outgoing-payment grants must be interactive. The only supported start mode is `redirect`.
- Flow: grant request -> response has `interact.redirect` -> user approves there -> wallet redirects to our `finish.uri` with a hash and `interact_ref` -> we POST to the `continue` URI -> we get the access token.
- In Rafiki (the software behind the test wallet) the authorization server draws no screen. It redirects to an identity provider (IdP) that the wallet operator builds. The IdP shows the consent screen, then tells the auth server accept or reject using a shared secret (`x-idp-secret`).
- Consequence: a client app cannot replace the test wallet's consent page. An accessible consent page can only be built by whoever runs the wallet.

### 3. We can run our own wallet (the "replica" idea)
- Rafiki is open source and ships a Local Playground: two mock wallets (Cloud Nine Wallet, Happy Life Bank) with the real Open Payments APIs, auth server and a mock account servicing entity, run with Docker.
- The Interledger test wallet itself is also open source (interledger/testnet).
- So a spoken, screen-reader-first consent screen could be built as the IdP of a mock wallet. This is real Open Payments software, not a fake.
- Caveats: heavy to run (Docker, several services, Postgres, Redis). Rafiki docs say it must not be used in production by non-regulated entities. The hackathon guide says to use the test environment confirmed at onboarding, so ask whether a local Rafiki counts.

### 4. Tokens are short-lived, grants are not
- Access tokens last 10 minutes by default. The client rotates them at the token's `manage` URL and gets a new token for the same grant.
- The client can revoke a token (DELETE on the manage URL) or cancel the grant (`client.grant.cancel` with the continue token and URI).
- Consequence: our backend must store the manage URL and continue token, and rotate before each payment. "Stop everything" can be a voice command that cancels the grant.

### 5. Receiving needs no approval
- Incoming-payment and quote grants are non-interactive by default.
- Every payment starts with an incoming payment created on the receiver's wallet, then a quote on the sender's wallet, then the outgoing payment.
- The quote returns the exact `debitAmount` and `receiveAmount`, fees included. The test wallet deducts a small fee on outgoing payments. So the amount we speak should come from the quote.

### 6. There is no balance and no push notification in the API
- The API has three resource types only: incoming-payment, quote, outgoing-payment. No balance endpoint was found.
- No client-facing webhook was found. Rafiki's webhooks go to the wallet operator, not to client apps. A client learns about received money by reading or listing incoming payments.
- Listing payments the client did not create (`list-all`) requires interaction by default in Rafiki.
- Consequence: "you have X left" can only mean "X left of your limit" plus our own record of payments, unless we run the wallet ourselves.

### 7. Client setup
- Node SDK `@interledger/open-payments`; `createAuthenticatedClient({ walletAddressUrl, privateKey, keyId })`.
- Keys are generated in the test wallet under Settings > Developer Keys. Requests are signed with Ed25519, so the key must stay on our server.
- Test wallet: wallet.interledger-test.dev. Sign up with email, fake KYC, create an account in a chosen asset, deposit play money, add a wallet address.

## Not confirmed (test or ask)
1. Does the test wallet's consent page work with TalkBack or VoiceOver?
2. Does the test wallet enforce the interval limit, and what does the API return when a payment exceeds it?
3. Is NGN an available asset on the test wallet?
4. Does rotation work on an already-expired token, and how long can a grant live?
5. Can organizers give access to customise consent, or does a local Rafiki count as an approved environment?
6. Is there any way to read a balance on the test wallet from a client?

## Sources
- Interactive grants: https://openpayments.guide/guides/create-interactive-grant/
- One-time payment: https://openpayments.guide/guides/make-onetime-payment/
- Recurring payments: https://openpayments.guide/guides/make-recurring-payments/
- Grant for future payments (docs preview build): https://deploy-preview-764--openpayments-preview.netlify.app/guides/outgoing-grant-future-payments
- Token rotation: https://openpayments.guide/snippets/token-rotate/
- Grant revoke: https://openpayments.guide/snippets/grant-revoke
- Rafiki identity provider: https://rafiki.dev/integration/requirements/idp
- Rafiki Local Playground: https://rafiki.dev/integration/playground/overview
- Test wallet source: https://github.com/interledger/testnet
- Node SDK snippets: https://github.com/interledger/open-payments-snippets
