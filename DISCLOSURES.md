# Disclosures

## AI assistance
Claude (Anthropic) was used throughout: research and planning (claude.ai), and code generation (Claude Code). All AI-written code was reviewed and run by the team. Prompts and context documents are in `docs/`.

## Prior work
No application code existed before the Sunday 15 Nov 2026 onboarding call. Before it, the team did research only (documents in `docs/`). A separate local voice-model experiment (Igbo, Yoruba, Hausa, English) was run on 15 Nov on the owner's PC; its results are not yet in this repo. If any code from it is reused, list it here.

## Dependencies and licences
(Builder: list every dependency with its licence, including `@interledger/open-payments`.)

## Development tooling (not part of the app)
`.claude/skills/` holds Matt Pocock's agent skills (https://github.com/mattpocock/skills, v1.3.2, commit 5863806, MIT licence, copied 16 Nov 2026). They are instructions for the AI coding assistant (planning, TDD, review). They are third-party prior work, are not shipped in the app and contain no application code.

## External services
Interledger test wallet (wallet.interledger-test.dev, play money). Voice providers planned: Spitch, ElevenLabs (not yet integrated).
