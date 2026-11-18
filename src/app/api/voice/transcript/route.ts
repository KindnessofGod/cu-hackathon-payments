import { body, fail, ok, requireCustomer } from "@/lib/http";
import { getStore } from "@/lib/store";

/**
 * Saves the live voice conversation in our own database (collection "conversations"), one line at a
 * time: what the customer said, what the agent said, and what the app told the agent (tool calls and
 * results). Only the customer's own device can add to their conversations.
 */
type Line = { at: string; who: "you" | "app" | "tool"; text: string };
type Conversation = { id: string; customerId: string; startedAt: string; updatedAt: string; lines: Line[] };

export async function POST(req: Request) {
  try {
    const customer = await requireCustomer();
    const b = await body(req);
    const id = String(b.conversationId ?? "");
    const who = b.who === "you" || b.who === "app" || b.who === "tool" ? b.who : null;
    const text = String(b.text ?? "").slice(0, 2000);
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id) || !who || !text) return Response.json({ error: { kind: "bad_input", message: "Bad transcript line." } }, { status: 400 });
    const store = getStore();
    const now = new Date().toISOString();
    const doc = (await store.get<Conversation>("conversations", id)) ?? { id, customerId: customer.id, startedAt: now, updatedAt: now, lines: [] };
    if (doc.customerId !== customer.id) return Response.json({ error: { kind: "not_allowed", message: "Not your conversation." } }, { status: 403 });
    if (doc.lines.length < 500) doc.lines.push({ at: now, who, text });
    doc.updatedAt = now;
    await store.put("conversations", id, doc);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
