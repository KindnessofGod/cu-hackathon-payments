# Disclosures

## AI assistance
Claude (Anthropic) was used throughout: research and planning (claude.ai), and code generation (Claude Code). All AI-written code was reviewed and run by the team. Prompts and context documents are in `docs/`.

## Prior work
No application code existed before the Sunday 15 Nov 2026 onboarding call. Before it, the team did research only (documents in `docs/`). A separate local voice-model experiment (Igbo, Yoruba, Hausa, English) was run on 15 Nov on the owner's PC; its results are not yet in this repo. If any code from it is reused, list it here.

## Dependencies and licences
Runtime:
- `@interledger/open-payments` 7.4.0 (Apache-2.0): the official Open Payments SDK.
- `next` 16.4.6, `react` 19.3.0, `react-dom` 19.3.0 (MIT): web framework.
- `qrcode` 1.5.4 (MIT): draws the pay code QR.
- `jsqr` 1.4.0 (Apache-2.0): reads the pay code QR from the seller's camera.
- `pg` 8.23.1 (MIT): Postgres driver for the deployed store.

Development only:
- `typescript` (Apache-2.0), `vitest` (MIT), `eslint` and `eslint-config-next` (MIT), type packages (MIT).

The project was started from the `create-next-app` template (MIT) on 16 Nov 2026.

## Development tooling (not part of the app)
`.claude/skills/` holds Matt Pocock's agent skills (https://github.com/mattpocock/skills, v1.3.2, commit 5863806, MIT licence, copied 16 Nov 2026). They are instructions for the AI coding assistant (planning, TDD, review). They are third-party prior work, are not shipped in the app and contain no application code.

## External services
Interledger test wallet (wallet.interledger-test.dev, play money). Voice providers planned: Spitch, ElevenLabs (not yet integrated).
