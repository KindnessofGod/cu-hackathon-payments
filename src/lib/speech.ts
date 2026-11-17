// Voice seams. Voice is the interface only: nothing here can approve money.
//
// SpeechOutput: the hosted voice (ElevenLabs, or Spitch for Igbo) via /api/voice/speak, falling back to
//               the browser's built-in English voice if the hosted one does not start within 4 seconds.
// Listening:    src/lib/listen.ts records a short answer; /api/voice/listen hears it (Spitch or ElevenLabs).
//               A spoken "pay" only opens the fingerprint prompt.

export type Lang = "en" | "yo" | "ig" | "ha" | "pcm";

export interface SpeechOutput {
  speak(text: string, lang?: Lang): Promise<void>;
  stop(): void;
}


export class BrowserSpeechOutput implements SpeechOutput {
  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-NG";
      u.rate = 0.95;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }
  stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}


/**
 * Plays one of the server's own sentences (the browser only names which one). Starts inside the tap
 * that asked for it, which iOS requires for sound. Falls back to the built-in voice on any failure.
 */
export class HostedSpeechOutput {
  private audio: HTMLAudioElement | null = null;
  constructor(private fallback: BrowserSpeechOutput) {}

  /** Resolves when the sentence has finished playing (or could not be played). */
  play(params: Record<string, string>, fallbackText: string): Promise<void> {
    this.stop();
    const a = new Audio(`/api/voice/speak?${new URLSearchParams(params).toString()}`);
    this.audio = a;
    let started = false;
    let gaveUp = false;
    return new Promise<void>((resolve) => {
      const giveUp = () => {
        if (started || gaveUp) return;
        gaveUp = true;
        a.pause();
        void this.fallback.speak(fallbackText).then(resolve);
      };
      const timer = setTimeout(giveUp, 4000);
      a.addEventListener("playing", () => {
        started = true;
        clearTimeout(timer);
      });
      a.addEventListener("ended", () => resolve());
      a.addEventListener("pause", () => {
        if (started) resolve();
      });
      a.addEventListener("error", () => {
        clearTimeout(timer);
        if (started) resolve();
        else giveUp();
      });
      a.play().catch(() => {
        clearTimeout(timer);
        giveUp();
      });
    });
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.fallback.stop();
  }
}
