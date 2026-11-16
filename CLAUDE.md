# CLAUDE.md: project context for any Claude session working in this repo

## What this project is
Entry in the **CU Next Gen Hackathon 2026** (Covenant University, Interledger **Open Payments**), **Track 2: Inclusive Payments and Financial Access**. Owner: Agbo Kindness, 500-level Computer Engineering student, student budget, owns an iPad and a Windows PC, no Mac, no paid Apple developer account.

Vision: a wallet that blind, elderly and non-reading people operate **alone**, with no helper (the helper is the security risk: card swaps, PIN sharing, relatives overdrawing). The person sets a spending cap once on the wallet's consent page; each payment is then approved inside our app (spoken read-back plus fingerprint later). Voice is the interface only; it never approves money.

## What to do now
The current priority is the **core Open Payments transaction, app to app** (receiver app creates an incoming payment; payer app quotes, gets consent, pays). Voice and passkey are planned for, not built yet. Full instructions: `docs/BUILD_PROMPT.md`. Start there.

## Hard rules
1. **Deadline: Wed 18 Nov 2026, 5:00 PM WAT.** Prefer a simple demo that works over a rich one that does not.
2. **Never fabricate** data, results, screenshots, balances or API behaviour. Label every simulated piece as simulated (UI, README, video). Keep the README table Implemented / Simulated / Planned honest.
3. **No secrets in git**: no keys, tokens, `.env`, private keys, personal data. If one leaks, say so and rotate.
4. Use test funds and the approved test environment only. The public test wallet is https://wallet.interledger-test.dev (assumed approved until organizers say otherwise).
5. Disclose AI assistance and prior work (`DISCLOSURES.md`). Competitive building started after the Sun 15 Nov onboarding call; keep `BUILD_LOG.md` dated.
6. Money is integers in minor units with `assetCode`/`assetScale`. No floats.
7. Amounts spoken or shown to the user come from the **quote**, not from user input.
8. Do not rely on APIs that do not exist: no balance endpoint, no client webhooks (poll), no escrow/refund.

## Docs map
- `docs/BUILD_PROMPT.md`: the task, scope, stack, checklist, timeline.
- `docs/hackathon-participant-guide.md`: organizers' rules and rubric (captured 14 Nov from their Notion page; rules and FAQ toggles were not fully readable).
- `docs/open-payments-technical-findings.md`: how Open Payments works plus six unconfirmed items.
- `docs/solution-direction-no-helper-wallet.md`: design decisions and honest limits.
- `docs/VOICE_PLAN.md`: voice decisions (Spitch and ElevenLabs beat local models in the owner's tests).
- `docs/OPEN_ITEMS.md`: unknowns and questions for organizers.
- `docs/PITCH_EVIDENCE.md`: short evidence summary for the inclusion case. Full research lives in the owner's Claude Project "CU BUILD HACKATHON".

## Style
Plain, direct English. Small commits with clear messages. Ask the owner only for the human tasks in `docs/BUILD_PROMPT.md` section 5 or for real product decisions.

## Agent skills

### Issue tracker

Tickets are local markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created only when needed. See `docs/agents/domain.md`.
