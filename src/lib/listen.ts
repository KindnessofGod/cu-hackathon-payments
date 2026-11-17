// Records one short spoken answer from the microphone and returns it as 16 kHz mono WAV.
// Recording stops after the person goes quiet (about 1 second after speaking) or after maxMs.
// The microphone is released as soon as recording ends.

export function canListen(): boolean {
  return typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof AudioContext !== "undefined";
}

const TARGET_RATE = 16000;

export async function recordAnswer(opts: { maxMs?: number; silenceMs?: number; waitForSpeechMs?: number } = {}): Promise<Blob | null> {
  const maxMs = opts.maxMs ?? 6000;
  const silenceMs = opts.silenceMs ?? 1000;
  const waitForSpeechMs = opts.waitForSpeechMs ?? 5000;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const ctx = new AudioContext();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let heardSpeech = false;
  let lastLoud = 0;
  const started = performance.now();
  // Noise floor: the first few blocks set it, so a noisy market does not count as speech.
  let floor = 0;
  let blocks = 0;

  const done = new Promise<void>((resolve) => {
    node.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      const now = performance.now();
      if (blocks < 3) floor = Math.max(floor, rms);
      blocks++;
      if (blocks > 3 && rms > Math.max(0.02, floor * 2.5)) {
        heardSpeech = true;
        lastLoud = now;
      }
      const elapsed = now - started;
      if (elapsed > maxMs || (heardSpeech && now - lastLoud > silenceMs) || (!heardSpeech && elapsed > waitForSpeechMs)) resolve();
    };
  });
  source.connect(node);
  node.connect(ctx.destination);
  await done;
  node.disconnect();
  source.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  const rate = ctx.sampleRate;
  await ctx.close();
  if (!heardSpeech) return null;
  return toWav(downsample(join(chunks), rate, TARGET_RATE), TARGET_RATE);
}

function join(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function toWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
