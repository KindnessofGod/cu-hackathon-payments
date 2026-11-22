# Voice cost experiment

Question: does the "smart but cheap" design (hear → AI model with Pay Alone's tools → speak, one turn
at a time) really cost about ₦10-30 per conversation, against ₦143 for one payment on the live
ElevenLabs agent (21 Nov 2026)?

The script plays 10 realistic conversations (pay, refuse, "who be this?", free Pidgin, send by voice,
a spending question, two things in one sentence, Yoruba, savings, an unsure customer) through the
full loop with real APIs, and measures every character spoken, second heard and AI token used. It
also reads ElevenLabs' own credit counter before and after, so the result is checked against the bill.

No real money moves: the wallet is a pretend one (`wallet.ts`) and the fingerprint is simulated.

## What you need

- Node 20 or newer.
- `ELEVENLABS_API_KEY` (already in your `.env.local` for the app).
- `GEMINI_API_KEY` from Google AI Studio (aistudio.google.com, "Get API key").
- Optional: `GEMINI_MODEL` (default `gemini-3.5-flash`, the model your live agent used),
  `ELEVENLABS_VOICE_ID`, `EXPERIMENT_USER_VOICE_ID` (a different voice to play the customer).

Put the keys in `.env.local` at the repo root; the script reads it.

**Credits:** your ElevenLabs account had about 1,300 credits left on 22 Nov. A full cold run needs
roughly 2,000-3,000 characters of speech, so start with a few conversations (below), record your own
voice for the customer turns (saves credits), or top up first. Auto top-up is off, so the script
stops with an error rather than charging you more.

## Run it

```bash
# 1. Check the plumbing, no APIs called (numbers are rough guesses):
npx tsx experiments/voice-cost/run.ts --dry

# 2. Small real run (about 5 conversations):
npx tsx experiments/voice-cost/run.ts --no-cache --only=pay-simple,free-pidgin-pay,send-by-voice,spend-question,two-things

# 3. Full run, worst case (nothing saved yet), then again with saved audio:
npx tsx experiments/voice-cost/run.ts --no-cache
npx tsx experiments/voice-cost/run.ts

# Cheaper voice for English and Pidgin:
npx tsx experiments/voice-cost/run.ts --no-cache --tts-model=eleven_flash_v2_5 --only=pay-simple,refuse,send-by-voice
```

Your own voice for the customer: record WAV files and save them as `audio/<conversation>-<turn>.wav`
(for example `audio/free-pidgin-pay-1.wav`). Without them, the script generates the customer's voice
once with ElevenLabs and keeps it; that setup is reported separately and not counted as running cost.

## Reading the result

Each run writes `results/<time>.md` (summary) and `results/<time>.csv` (every turn). Look at:

1. **Per conversation total** against the live agent's ₦143.
2. **Checked against ElevenLabs' own counter**: credits used during the run. If this is far above
   the characters the script counted, the speak line is too low and the summary says by how much.
3. **AI model line**: priced with the defaults in `prices.ts`. Check the real charge on the Google
   AI Studio usage page, and set `GEMINI_PRICE_*` if Google's price for your model differs.
4. **Tools column**: a ⚠ means the AI did not do what the conversation needed. Cheap but wrong
   does not count.
5. **Waiting time**: how long the customer waits per AI turn, without streaming.

The `--dry` numbers are guesses and prove nothing about cost; only a real run does.
