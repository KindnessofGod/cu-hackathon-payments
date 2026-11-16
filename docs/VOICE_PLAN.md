# Voice plan (planned, not built yet)

## Decision from the owner's own tests (16 Nov 2026)
The owner ran a local experiment on his PC (Igbo, Yoruba, Hausa, English). Result in his words: local models were rough; **Spitch and ElevenLabs worked far better** and are the choice for the project. The experiment's files stayed on his PC and were not uploaded, so the detailed numbers are not in this repo. When he turns the PC on, the results (`Documents/voice-test`: `LOG.md`, results table, recommendation) should be pushed here under `docs/voice-experiment/` (no API keys).

Both services need API keys. Keys live in environment variables on the server only, never in the browser or git. Cost and free-credit limits were not confirmed; check before relying on them.

## What to build in the core demo (the seams only)
```ts
interface SpeechOutput {            // text to speech
  speak(text: string, lang: 'en' | 'yo' | 'ig' | 'ha' | 'pcm'): Promise<void>;
  stop(): void;
}
interface SpeechInput {             // speech to text; no-op for now
  listen(lang: string): Promise<string>;
}
interface ApprovalProvider {        // approves ONE payment
  approve(p: { quoteId: string; debitAmount: string; assetCode: string; assetScale: number; receiver: string }): Promise<ApprovalProof>;
}
```
- Default `SpeechOutput` = browser `speechSynthesis` (English only), clearly labelled as a placeholder.
- Default `SpeechInput` = unsupported (typed input only).
- Default `ApprovalProvider` = on-screen confirm button. Later: WebAuthn passkey whose challenge is a hash of the quote id and amount, so an approval cannot be reused for another payment.
- The payment API must refuse to create an outgoing payment without an `ApprovalProof` for that exact quote.

## Later (after Stages 1 and 2 work)
1. Spitch and/or ElevenLabs adapters behind `SpeechOutput` and `SpeechInput`, called from server routes (audio returned to the browser).
2. Spoken read-back before approval: "Send five thousand naira to Chioma. Total leaving your account: five thousand and fifty." Amounts come from the quote.
3. Speech input only for commands and contact names; speech never approves money, because voices can be cloned.
4. Recognition errors of 20-30% were reported for open models, so confirm every amount and recipient by read-back plus the approval step.

## iOS constraints (the owner uses an iPad, no Mac)
- No custom system wake word for third-party apps; a web app cannot listen when closed or locked. Workaround: Shortcuts + Vocal Shortcuts (iOS 18) to open the app, then talk inside the app.
- Browser speech recognition is not available inside Home Screen web apps. Record audio and send it to a provider instead.
- Audio and microphone need a first user tap.
- WebAuthn passkeys need HTTPS (Vercel provides it).
