// Unit prices used to turn what was measured into money. Every number can be overridden with an
// environment variable, so a price change never needs a code change.
//
// ElevenLabs prices: elevenlabs.io/pricing/api, read 22 Nov 2026 (same on every plan).
// Gemini prices: the defaults are what ElevenLabs passed through for gemini-3.5-flash on your
// 21 Nov conversation bill (input $1.65, cached input $0.165, output $9.90 per million tokens).
// Google's own price for the model you pick may differ: check ai.google.dev/pricing and set the
// GEMINI_PRICE_* variables before trusting the AI-model line.

const num = (name: string, fallback: number) => {
  const v = process.env[name];
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** US dollars per 1,000 characters of text to speech, by ElevenLabs model id. */
export const TTS_USD_PER_1K: Record<string, number> = {
  eleven_v4: 0.08,
  eleven_v3: 0.08,
  eleven_multilingual_v2: 0.08,
  eleven_flash_v2_5: 0.04,
  eleven_turbo_v2_5: 0.04,
};

export const PRICES = {
  ngnPerUsd: num("NGN_PER_USD", 1357.19),
  sttUsdPerHour: num("STT_USD_PER_HOUR", 0.2),
  geminiInputPerM: num("GEMINI_PRICE_INPUT_PER_M", 1.65),
  geminiCachedPerM: num("GEMINI_PRICE_CACHED_PER_M", 0.165),
  geminiOutputPerM: num("GEMINI_PRICE_OUTPUT_PER_M", 9.9),
  /** Starter plan: $6 for 30,000 credits. Used only to price the credit balance check. */
  usdPerCredit: num("ELEVEN_USD_PER_CREDIT", 6 / 30000),
};

export function ttsUsd(model: string, chars: number): number {
  const per1k = num("TTS_USD_PER_1K", TTS_USD_PER_1K[model] ?? 0.08);
  return (chars / 1000) * per1k;
}

export function sttUsd(seconds: number): number {
  return (seconds / 3600) * PRICES.sttUsdPerHour;
}

export function llmUsd(t: { input: number; cached: number; output: number }): number {
  return (
    ((t.input - t.cached) / 1e6) * PRICES.geminiInputPerM +
    (t.cached / 1e6) * PRICES.geminiCachedPerM +
    (t.output / 1e6) * PRICES.geminiOutputPerM
  );
}

/** What the live ElevenLabs agent actually cost, from your own account (pulled 22 Nov 2026). */
export const AGENT_BASELINE = {
  note: "Live agent, 'Payment to Mama Chris', 21 Nov 2026, 52 s, conv_4001m7z3mk9bfhtb9vza2krshpas",
  usdPerPaymentConversation: 0.1057,
  usdPerMinute: 0.095,
};
