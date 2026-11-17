# Disclosures

## AI assistance
Claude (Anthropic) was used throughout: research and planning (claude.ai), and code generation (Claude Code). All AI-written code was reviewed and run by the team. Prompts and context documents are in `docs/`.

## Prior work
No application code existed before the Sunday 15 Nov 2026 onboarding call. Before it, the team did research only (documents in `docs/`).

## Dependencies and licences
Runtime:
- `@interledger/open-payments` 7.4.0 (Apache-2.0): the official Open Payments SDK.
- `next` 16.4.6, `react` 19.3.0, `react-dom` 19.3.0 (MIT): web framework.
- `qrcode` 1.5.4 (MIT): draws the pay code QR.
- `jsqr` 1.4.0 (Apache-2.0): reads the pay code QR from the seller's camera.
- `pg` 8.23.1 (MIT): Postgres driver for the deployed store.
- `spitch` 1.49.0 (Apache-2.0): Spitch's official SDK, used for the Igbo voice.
- `@simplewebauthn/server` 14.1.0 and `@simplewebauthn/browser` 14.0.0 (MIT): fingerprint (passkey) setup and checks.

Development only:
- `typescript` (Apache-2.0), `vitest` (MIT), `eslint` and `eslint-config-next` (MIT), type packages (MIT).

The project was started from the `create-next-app` template (MIT) on 16 Nov 2026.

## Development tooling (not part of the app)
`.claude/skills/` holds Matt Pocock's agent skills (https://github.com/mattpocock/skills, v1.3.2, commit 5863806, MIT licence, copied 16 Nov 2026). They are instructions for the AI coding assistant (planning, TDD, review). They are third-party prior work, are not shipped in the app and contain no application code.

## Companion work in the build window
A voice feasibility test (English, Pidgin, Yoruba, Igbo, Hausa) was built during the competition build window, starting Sun 15 Nov 2026 after the onboarding call (its log's first timed entry is 14:16 WAT), in the separate repo https://github.com/KindnessofGod/ai-voice-demo (uploaded to GitHub on 16 Nov). It was also made with Claude's help. Its findings shape `docs/VOICE_PLAN.md`.

## External services
Interledger test wallet (wallet.interledger-test.dev, play money). Voice providers: ElevenLabs (text to speech, free plan, which is non-commercial) and Spitch (Igbo text to speech). Only sentences built by our server from the payment record are sent to them; no personal data beyond the seller's public wallet name and the amounts.
