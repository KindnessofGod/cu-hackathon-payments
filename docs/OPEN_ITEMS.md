# Open items (update as you learn)

## Unconfirmed technical points (from the research doc)
1. Does the test wallet's consent page work with TalkBack / VoiceOver?
2. Does the test wallet enforce the interval limit, and what does the API return when a payment exceeds it?
3. Is NGN available as an asset on the test wallet? (If not, use an available asset and say so; do not fake naira.)
4. Does token rotation work on an already-expired token, and how long can a grant live?
5. Can organizers allow a customised consent screen, or does a local Rafiki count as an approved environment?
6. Is there any way to read a balance from a client? (Nothing found in the docs.)
7. What happens to a payment already in progress when the app cancels the grant?

## Organizer questions (the Sunday 15 Nov onboarding call already happened; its recording was not readable)
- Which wallet or test environment is approved? Any funds, keys or credits provided?
- Is a customised consent screen or a local Rafiki allowed?
- Exact rule on AI tool use and how to disclose it. (The Rules and FAQ toggles on the Notion page were not readable on 15 Nov.)
- Where to ask technical questions and support hours (placeholders on the page); registration and submission problems go to @ojumah on Telegram.
- Submission form link was due "by Tuesday 12AM".

## Product decisions still open
- How a shop's payment request reaches the user's phone (proposal: the seller types the buyer's short code, or the buyer scans the QR).
- Launch languages for voice: English and Pidgin first; Yoruba, Igbo, Hausa as stretch.
- Hosting store for the deployed demo (SQLite locally; Supabase or Upstash when deployed).

## Added 16 Nov
- Does paying between two wallet addresses on the same test wallet account work? (Planned first test.)
- What status and wording does the test wallet return for a payment over the grant limit? `src/lib/op/real.ts` guesses from the text; correct it once observed.
- Does the callback hash use the auth server URL with or without a trailing slash? Both are accepted for now.
- On iPadOS 26 (iPad Air 3): does VoiceOver focus a new lock-screen notification, will Siri open a Home Screen web app, and do passkeys work inside one?
- Does the seller's PC have a webcam for scanning?
- Team size: the rules require at least two students.

## Build log of problems
(Builder: add anything that fails, with the exact error and what you tried.)
