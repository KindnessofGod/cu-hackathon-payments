// Decides whose voice credits a request may use. Real-wallet customers keep working as before (the owner's
// own devices). A SIMULATED demo customer, who could be anyone on the internet, has no voice until they
// either bring their own ElevenLabs key (powers speaking and listening only) or are approved as a judge
// (powers the live conversation too, inside hard caps). The key itself lives only in an encrypted,
// httpOnly browser cookie: our server never stores it and never logs it.
import type { Customer } from "../domain";
import { judgeFromCookie, spendJudgeVoice, type JudgeUse } from "../judge";
import { isMockWallet } from "../op";
import { open } from "../secret";

export type VoiceGrant = { who: "owner" } | { who: "byok"; elevenKey: string } | { who: "judge"; id: string };
export type VoiceDenied = { denied: true; reason: "locked" | "agent_needs_judge" | "capped"; message: string };

export const BYOK_COOKIE = "cw_byok";
export const JUDGE_COOKIE = "cw_judge";

function isGated(c: { wallet: { id: string } }): boolean {
  return isMockWallet(c.wallet.id) || process.env.VOICE_GATE_ALL === "1";
}

function unseal(v: string | undefined): string | null {
  if (!v) return null;
  try {
    return open(v);
  } catch {
    return null;
  }
}

export async function voiceGrant(customer: { wallet: { id: string } }, jar: { byok?: string; judge?: string }, use: JudgeUse): Promise<VoiceGrant | VoiceDenied> {
  if (!isGated(customer)) return { who: "owner" };
  const judgeId = await judgeFromCookie(jar.judge);
  let capped: string | undefined;
  if (judgeId) {
    const spent = await spendJudgeVoice(judgeId, use);
    if (spent.ok) return { who: "judge", id: judgeId };
    capped = spent.reason;
  }
  const key = unseal(jar.byok);
  if (key) {
    if (use === "agent") {
      return { denied: true, reason: "agent_needs_judge", message: "The live conversation needs judge access. Your own key still powers the spoken read-back and spoken answers." };
    }
    return { who: "byok", elevenKey: key };
  }
  if (capped) return { denied: true, reason: "capped", message: capped };
  return { denied: true, reason: "locked", message: "Voice is locked in the demo. Add your own ElevenLabs key or request judge access on the Try it page." };
}

/** What the screen may say about voice, without using any allowance. */
export async function voiceStatus(customer: { wallet: { id: string } } | null, jar: { byok?: string; judge?: string }): Promise<"open" | "judge" | "byok" | "locked"> {
  if (customer && !isGated(customer)) return "open"; // no customer yet (a visitor choosing how to unlock voice) counts as gated
  if (await judgeFromCookie(jar.judge)) return "judge";
  return unseal(jar.byok) ? "byok" : "locked";
}
