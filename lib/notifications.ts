// Wraps the browser's Notification + Service Worker APIs. Every function
// fails quietly (returns false/null) on browsers or contexts that don't
// support them, rather than throwing — this feature is a bonus, not a
// requirement for the app to work.

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.error("Service worker registration failed:", err);
    return null;
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

const NOTIFICATION_TAG = "core-architect-timer";

export async function showTimerNotification(
  registration: ServiceWorkerRegistration,
  title: string,
  body: string
) {
  try {
    await registration.showNotification(title, {
      body,
      tag: NOTIFICATION_TAG, // replaces the previous one instead of stacking
      requireInteraction: true,
      icon: "/icon-192.png",
      actions: [{ action: "pause", title: "Pause" }],
    } as NotificationOptions);
  } catch (err) {
    console.error("Failed to show notification:", err);
  }
}

export async function clearTimerNotification(registration: ServiceWorkerRegistration) {
  try {
    const existing = await registration.getNotifications({ tag: NOTIFICATION_TAG });
    existing.forEach((n) => n.close());
  } catch (err) {
    console.error("Failed to clear notification:", err);
  }
}

/**
 * Listens for the service worker relaying a "Pause" action-button tap.
 * Returns a cleanup function.
 */
export function listenForPauseRequests(onPause: () => void): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data?.type === "PAUSE_REQUEST") onPause();
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
