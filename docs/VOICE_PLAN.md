# Voice plan (planned, not built yet)

## Findings from the owner's voice test (repo KindnessofGod/ai-voice-demo, 15 Nov 2026)
All its tests used synthetic voices plus public recordings (FLEURS); no real person has spoken a command yet.

- **People say amounts in English** inside Yoruba, Igbo and Hausa sentences. With English amounts, ElevenLabs heard 9 of 10 requests fully right; with native number words, Yoruba and Igbo amounts mostly failed.
- **Hearing (speech to text):** ElevenLabs Scribe v3 is best overall on real speech (words wrong: Yoruba 24%, Igbo 22%, Hausa 17%) and writes amounts as digits. Spitch: Hausa 14%, Yoruba 38%, Igbo 33%, and once heard "twenty thousand five hundred" as 2,500.
- **Speaking (text to speech):** ElevenLabs Eleven v4 for English, Pidgin, Yoruba, Hausa. It rejects Igbo, so Igbo is spoken by Spitch. Spitch has no Pidgin voice.
- **Local models:** too slow on a CPU (NaijaVox 30 to 100 s per phrase), or weak, or non-commercial. Not for the demo.
- **Short words fail everywhere:** "yes", "no", "stop" are often misheard, and so are long names.
- **Safety that held:** 0 wrong payments slipped through in 165+ recognitions, because of read-back, saved contacts only, refusing half-heard numbers, and requiring the amount to be said again instead of a bare "yes".
- **Cost and network:** about 2 US cents per conversation with ElevenLabs. Hosted calls took 3 to 7 s on a good connection and 40 to 180 s on a bad one. The ElevenLabs free plan is non-commercial.
- **Not checked:** every non-English sentence was written by Claude and needs a native speaker.

## What this means for Pay Alone
- Our design avoids the weakest part of their results. Money is approved by **fingerprint**, and amounts come from the **quote**, so speech recognition is never in the money path: no "yes", no spoken amounts, no spoken names.
- So voice **output** is what matters for the demo, and voice **input** can stay planned.
- Planned integration (not built):
  1. A server route `/api/voice/speak` takes a sentence id and language. The server builds the sentence itself from the quote (never from text sent by the browser), picks Spitch for Igbo and ElevenLabs for the rest, and returns audio. Keys stay in Vercel environment variables.
  2. A 4-second timeout, then fall back to the device's built-in voice, so a slow network never leaves the user in silence.
  3. Amounts read in English inside the native sentence, matching how people speak.
  4. Later, voice input only for safe commands ("what did I spend this week", "stop everything"), each confirmed before acting.

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
