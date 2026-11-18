import { fail, ok, requireCustomer } from "@/lib/http";
import { intentOf } from "@/lib/voice/intent";
import { transcribe } from "@/lib/voice/providers";
import { isLang } from "@/lib/voice/sentences";

const MAX_BYTES = 1_000_000; // about 30 seconds of 16 kHz mono; an answer is a word or two

/**
 * Hears the customer's spoken answer to a payment request (a short WAV recording) and says whether it
 * was "pay", "refuse" or "unclear". It changes nothing: the page decides what to do, and "pay" only
 * opens the fingerprint prompt. The recording is not stored.
 */
export async function POST(req: Request) {
  try {
    await requireCustomer();
    const q = new URL(req.url).searchParams;
    const lang = isLang(q.get("lang")) ? (q.get("lang") as Parameters<typeof intentOf>[1]) : "en";
    const wav = new Uint8Array(await req.arrayBuffer());
    if (wav.byteLength < 44 || wav.byteLength > MAX_BYTES) return ok({ intent: "unclear", heard: "" });
    try {
      const { text, provider } = await transcribe(wav, lang);
      return ok({ intent: intentOf(text, lang), heard: text.slice(0, 200), provider });
    } catch (e) {
      console.error("listening failed:", e instanceof Error ? e.message : "unknown");
      return ok({ intent: "unclear", heard: "", unavailable: true });
    }
  } catch (e) {
    return fail(e);
  }
}
