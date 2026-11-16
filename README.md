# Open Payments wallet for people who must operate alone

CU Next Gen Hackathon 2026, Track 2: Inclusive Payments and Financial Access. Built on Interledger Open Payments.

> Status: **scaffold only**. No application code yet. The builder works from `docs/BUILD_PROMPT.md`. This README must be kept honest as the build progresses.

## The problem
Blind, elderly and non-reading Nigerians often cannot use their own money alone. Banks refuse cards, and apps and ATMs do not talk, so they hand a card and PIN to a helper. Helpers sometimes steal. See `docs/PITCH_EVIDENCE.md`.

## The idea
Remove the helper. The person approves a spending cap once on the wallet's consent page. After that each payment is read back to them and approved inside the app (fingerprint later). The wallet, not our server, enforces the cap. Voice is the interface only and never approves money.

## How Open Payments is used
Incoming payment (receiver) -> quote (payer) -> interactive outgoing-payment grant with limits -> outgoing payment. Details: `docs/open-payments-technical-findings.md`.

## What works today
| Feature | Implemented | Simulated | Planned |
|---|---|---|---|
| App-to-app payment on the Interledger test wallet |  |  | yes |
| Failure states (expired code, quote failure, grant rejected, over limit, wallet down) |  |  | yes |
| Standing spending cap and in-app approval |  |  | yes |
| Cancel grant ("stop everything") |  |  | yes |
| Spoken read-back (Spitch / ElevenLabs) |  |  | yes |
| Passkey (fingerprint) approval |  |  | yes |
| USSD / feature-phone access |  |  | yes (not started) |

## Run it
(To be written by the builder: one-command local run, hosted URL, test wallet steps.)

## Submitted version
Commit hash: (record at submission time)

## Documents
`CLAUDE.md` (context for Claude sessions), `docs/BUILD_PROMPT.md` (the build task), `docs/hackathon-participant-guide.md` (rules), `docs/open-payments-technical-findings.md`, `docs/solution-direction-no-helper-wallet.md`, `docs/VOICE_PLAN.md`, `docs/OPEN_ITEMS.md`, `docs/PITCH_EVIDENCE.md`, `DISCLOSURES.md`, `BUILD_LOG.md`.
