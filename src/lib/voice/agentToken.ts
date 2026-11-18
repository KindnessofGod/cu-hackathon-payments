/** A one-time WebRTC token for an ElevenLabs agent. The API key stays on the server. */
export async function agentToken(agentId: string): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`, {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("agent token failed:", res?.status, res ? (await res.text()).slice(0, 200) : "no answer");
    return null;
  }
  return ((await res.json()) as { token: string }).token;
}

/** A signed WebSocket URL for the same agent: the fallback when WebRTC cannot connect (VPNs, strict networks). */
export async function agentSignedUrl(agentId: string): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`, {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { signed_url: string }).signed_url;
}

/** ElevenLabs agents accept these of our languages. Igbo is not supported (checked 18 Nov); Pidgin runs in English. */
export const AGENT_LANG = { en: "en", pcm: "en", yo: "yo", ig: "en", ha: "ha" } as const;
