// Voice seams. Voice is the interface only: nothing here can approve money.
//
// SpeechOutput: today a PLACEHOLDER using the browser's built-in English voice.
//               Planned: Spitch / ElevenLabs adapters for Nigerian languages (see docs/VOICE_PLAN.md).
// SpeechInput:  not built. Typed and tapped input only.

export type Lang = "en" | "yo" | "ig" | "ha" | "pcm";

export interface SpeechOutput {
  speak(text: string, lang?: Lang): Promise<void>;
  stop(): void;
}

export interface SpeechInput {
  listen(lang: Lang): Promise<string>;
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

export class UnsupportedSpeechInput implements SpeechInput {
  listen(): Promise<string> {
    return Promise.reject(new Error("Speech input is planned, not built."));
  }
}
