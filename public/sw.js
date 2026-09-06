// Minimal service worker: no offline caching, just enough to (a) qualify
// as an installable PWA and (b) let a notification's action button talk
// back to the page that's still open. It cannot run the timer itself —
// there's no reliable background execution on the web for that — so this
// only helps while the app/tab is alive in the background, most reliably
// on Android Chrome (especially once "installed" via Add to Home Screen).
// iOS Safari's support for background notifications from a PWA is far more
// limited by Apple's own restrictions, regardless of what this file does.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action; // "pause" or "" (body tap)
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (action === "pause") {
        clientList.forEach((client) => client.postMessage({ type: "PAUSE_REQUEST" }));
        return;
      }
      // Body tap (no action) — just bring the app to the front.
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow("/dashboard");
    })
  );
});
