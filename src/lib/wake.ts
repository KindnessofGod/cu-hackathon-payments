// Free standby listening between conversations. The browser's own speech recognition (on iPad,
// Apple's, the same as Siri dictation) listens for a greeting; only then does the paid live
// conversation start. No audio is sent to our server or to ElevenLabs while on standby.

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

/** Words that wake the voice: a greeting or the app's name, in English, Pidgin, Yoruba and Hausa. */
const WAKE = /\b(pay ?alone|paylon|pay loan|hello|hi|hey|good (morning|afternoon|evening)|my wallet|wallet|abeg|oya|how far|bawo|e ?k[aá]a|ẹ ?k[aá]a|sannu|ina kwana|barka)\b/i;

export function canWake(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}

/** Starts standby listening. Calls onWake once when a wake word is heard. Returns stop(), or null if not possible. */
export function startWake(onWake: (heard: string) => void, onBlocked?: (why: string) => void): (() => void) | null {
  const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) return null;
  let stopped = false;
  let rec: Rec | null = null;
  let fails = 0;
  const run = () => {
    if (stopped) return;
    rec = new Ctor();
    rec.lang = "en-NG";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = e.results[i]?.[0]?.transcript ?? "";
        if (WAKE.test(said)) {
          stopped = true;
          rec?.abort();
          onWake(said);
          return;
        }
      }
      fails = 0;
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stopped = true;
        onBlocked?.(e.error);
      } else fails++;
    };
    rec.onend = () => {
      if (!stopped) setTimeout(run, fails > 3 ? 3000 : 300); // the browser ends recognition now and then; carry on
    };
    try {
      rec.start();
    } catch {
      setTimeout(run, 1000);
    }
  };
  run();
  return () => {
    stopped = true;
    try {
      rec?.abort();
    } catch {}
  };
}
