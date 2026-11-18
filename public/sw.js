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
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Open Pay Alone.",
      tag: data.tag || "pay-alone",
      renotify: true,
      requireInteraction: true,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/wallet" },
    }),
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
