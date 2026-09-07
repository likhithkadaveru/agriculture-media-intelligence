/*
 * Service worker for official alerts.
 *
 * Deliberately minimal: it does not cache the command screen. The site's
 * value is that it is current, and a stale-but-instant board is worse than
 * a slow one — an officer acting on yesterday's numbers is the failure this
 * whole system exists to prevent.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "Agriculture Intelligence";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      tag: payload.tag || "agri-alert",
      data: { url: payload.url || "/" },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Focus an already-open board rather than stacking duplicate tabs.
      for (const client of list) {
        if (client.url.includes(new URL(url, self.location.origin).pathname) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
