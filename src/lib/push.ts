// Lock-screen alerts (Web Push). A seller's request wakes the customer's locked iPad or phone:
// the system shows the alert and VoiceOver reads it. The alert never contains a way to pay;
// the customer unlocks with their own fingerprint and answers inside the app.
import webpush from "web-push";
import { sha256 } from "./secret";
import { getStore } from "./store";

export interface StoredPush {
  id: string;
  customerId: string;
  subscription: webpush.PushSubscription;
  createdAt: string;
}

const store = () => getStore();

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configured = false;
function configure(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://payalone.vercel.app", pub, priv);
    configured = true;
  }
  return true;
}

export function isSubscription(x: unknown): x is webpush.PushSubscription {
  const s = x as webpush.PushSubscription;
  return Boolean(
    s &&
      typeof s.endpoint === "string" &&
      /^https:\/\//.test(s.endpoint) &&
      s.endpoint.length < 2000 &&
      typeof s.keys?.p256dh === "string" &&
      typeof s.keys?.auth === "string",
  );
}

export async function savePush(customerId: string, subscription: webpush.PushSubscription): Promise<void> {
  const id = sha256(subscription.endpoint);
  const doc: StoredPush = {
    id,
    customerId,
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
    createdAt: new Date().toISOString(),
  };
  await store().put("push", id, doc);
}

export async function removePush(customerId: string, endpoint: string): Promise<void> {
  const id = sha256(endpoint);
  const doc = await store().get<StoredPush>("push", id);
  if (doc && doc.customerId === customerId) await store().delete("push", id);
}

export async function pushCount(customerId: string): Promise<number> {
  return (await store().listBy<StoredPush>("push", "customerId", customerId)).length;
}

export interface Alert {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Send one alert to every device of this customer. Never throws: a failed alert must not fail the request. */
export async function alertCustomer(customerId: string, alert: Alert): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  try {
    if (!configure()) return { sent, failed };
    const subs = await store().listBy<StoredPush>("push", "customerId", customerId);
    await Promise.all(
      subs.map(async (p) => {
        try {
          const r = await webpush.sendNotification(p.subscription, JSON.stringify(alert), { TTL: 600, urgency: "high", timeout: 5000 });
          console.log("push sent:", new URL(p.subscription.endpoint).host, r.statusCode, alert.tag);
          sent++;
        } catch (e) {
          failed++;
          const code = (e as { statusCode?: number }).statusCode;
          // 404/410: the device turned alerts off or the app was removed. Forget it.
          if (code === 404 || code === 410) await store().delete("push", p.id).catch(() => undefined);
          console.error("push failed:", code ?? "", (e as { body?: string }).body ?? (e instanceof Error ? e.message : e));
        }
      }),
    );
  } catch (e) {
    console.error("push failed:", e instanceof Error ? e.message : e);
  }
  return { sent, failed };
}
