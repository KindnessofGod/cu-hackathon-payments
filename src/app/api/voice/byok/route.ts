import { body, fail, ok } from "@/lib/http";
import { DomainError } from "@/lib/domain";
import { seal } from "@/lib/secret";
import { BYOK_COOKIE } from "@/lib/voice/entitlement";

// A visitor's own ElevenLabs key. It is checked once with ElevenLabs, then kept ONLY in an encrypted,
// httpOnly cookie that ends when the browser closes. It is never written to our database and never logged.
// It is used for the spoken read-back and spoken answers (text to speech, speech to text), nothing else.

export async function POST(req: Request) {
  try {
    const key = String((await body(req)).key ?? "").trim();
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(key)) throw new DomainError("bad_input", "That does not look like an ElevenLabs API key.");
    const res = await fetch("https://api.elevenlabs.io/v1/models", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res) throw new DomainError("wrong_state", "Could not reach ElevenLabs to check the key. Try again.");
    // A restricted key may be refused for this listing but is still a real key.
    const text = res.ok ? "" : await res.text().catch(() => "");
    if (!res.ok && !(res.status === 401 && text.includes("missing_permissions"))) throw new DomainError("not_allowed", "ElevenLabs did not accept that key.");
    const out = ok({ ok: true });
    out.cookies.set(BYOK_COOKIE, seal(key), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    return out;
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  const out = ok({ ok: true });
  out.cookies.set(BYOK_COOKIE, "", { path: "/", maxAge: 0 });
  return out;
}
