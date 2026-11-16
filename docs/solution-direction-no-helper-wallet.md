# Solution direction: a wallet they operate alone (no helper)

Working notes from 14 Nov 2026. This is a direction under discussion, not a final design. Companion docs: `open-payments-technical-findings.md` (how Open Payments works) and `PITCH_EVIDENCE.md` (evidence summary).

## Decision made by the team
- Target users: people who cannot carry out transactions on their own (blind and visually impaired, elderly, people who cannot read) and so depend on someone else, which exposes them to theft.
- Goal: remove the third party. The person sends, pays, receives and checks money by themselves. An earlier "Trusted Helper" idea (a capped permission for a helper) was rejected for this reason.
- Track: Track 2, Inclusive Payments and Financial Access.

## The problems the design answers
1. Banks push them into dependence: card refused, co-signer, joint account, indemnity, "bring a guide".
2. The helper steals: card swap at the ATM after learning the PIN, or a relative takes extra. Losses from 495,000 to over 2 million NGN in police reports.
3. They cannot check what happened: alerts are not spoken, tokens do not talk, USSD times out.
4. Nobody fixes it afterwards.
5. Bank apps exclude them: unlabelled buttons, poor screen-reader support, facial checks that exclude blind users (Association for the Blind survey of 10 banks).
- Note: some blind people can use an ATM. The failure is that ATMs do not talk, so they ask a stranger and the PIN leaks.

## Current design
**Setup, once**
- The user sets their own spending limit by voice (example: 20,000 a week).
- They approve that limit once on the wallet's consent page (Open Payments interactive grant with `debitAmount` and `interval`).
- They register a passkey, which uses the phone's own screen unlock (fingerprint, face or PIN).

**Every payment after that**
1. They speak: "send five thousand to Chioma." Recipients come from saved contacts, so speech never has to spell a name.
2. App creates the incoming payment and the quote.
3. App speaks the exact amount leaving the account (from the quote, fees included) and the recipient.
4. They approve with their fingerprint. The approval is tied to that one payment.
5. App creates the outgoing payment under the standing grant and speaks the result.

**Paying a shop or getting cash from a POS agent**
- The seller requests an amount; the user's phone speaks the request; the fingerprint approves. The agent receives a payment and hands over cash. Nobody else touches a card, PIN or phone.
- Open question: how the request reaches the phone. Proposal: seller types the buyer's short code.

**Checking money**
- Every payment in or out is spoken. "What did I spend this week?" is answered aloud.
- Open Payments has no balance endpoint, so the app can say "X left of your weekly limit" and read its own payment history, not the true account balance (unless we run the wallet).

**Protection without a helper**
- The wallet enforces the cap, so a trick or coercion can cost at most the rest of that interval's limit.
- Spoken read-back before every approval.
- "Stop everything" cancels the grant.

## Authentication choices and why
- Voice is the interface only. It never approves money, because voices can be cloned.
- Fingerprint by default, not face. Facial checks are a documented barrier for blind users; a fingerprint works by touch.
- Passkeys (WebAuthn) mean no biometric system to build. Needs HTTPS and a tap before the prompt.
- The realistic attacker is the person standing next to the user, not a voice clone. Read-back in an earphone plus the cap is the answer.

## Voice technology
See `VOICE_PLAN.md`. Update from the owner's tests: Spitch and ElevenLabs beat local open models. Earlier candidates (NaijaVox 2.0, SBPN, SoroTTS, YarnGPT, 9jaLingo) are unverified and not the chosen path.

## Honest limits to state in the pitch
- Setup consent is on the wallet provider's page; its screen-reader accessibility is untested.
- Users without a smartphone are not covered (USSD or voice call is "planned").
- Our server holds the capped spending permission.
- Evidence gap: most stories are from blind people in the South; few elderly or non-reading people in their own words.

## Open decisions
1. Public test wallet (lighter, within the rules) or our own Rafiki wallet (we control consent and balance; heavy; needs organizer approval). Current assumption: public test wallet.
2. How a shop's payment request reaches a blind user's phone.
3. Launch languages: English and Pidgin first, others as stretch.
4. Whether laptops can run Docker for a local Rafiki.

## Hackathon dates that constrain this
- Onboarding Sun 15 Nov, 2 PM WAT. Competitive building starts after it; earlier code must be disclosed.
- **Submission Wed 18 Nov, 5 PM WAT.**
- Finalists notified Thu 19 Nov 7 AM; Hacker House Thu 19 and Fri 20; final pitch Sat 21 Nov (5-minute demo plus 3-minute Q&A).
- Rubric: inclusion impact 30%, Open Payments integration 25%, execution 20%, usability and accessibility 15%, originality 10%.
