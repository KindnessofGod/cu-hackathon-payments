// Pay Alone service worker: only lock-screen alerts. No caching, no offline payments.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Pay Alone";
  const body = data.body || "Open Pay Alone.";
  const url = data.url || "/wallet";
  // Every push must show an alert, or iPadOS stops delivering them. Fall back to the plainest one.
  const log = (what) => fetch("/api/voice/debug", { method: "POST", body: `sw: ${what}` }).catch(() => {});
  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, { body, tag: data.tag || "pay-alone", icon: "/icon-192.png", data: { url } });
        await log(`push received, alert shown (${data.tag || ""}) permission=${Notification.permission}`);
      } catch (e) {
        await self.registration.showNotification(title, { body, data: { url } }).catch(() => {});
        await log(`push received, first alert failed: ${e && e.message}`);
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/wallet", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).pathname.startsWith("/wallet") && "focus" in c) {
          await c.focus();
          c.postMessage({ type: "check-requests" });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
