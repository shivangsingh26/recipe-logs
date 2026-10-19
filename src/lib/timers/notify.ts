// System notifications for finished timers (used while the app is in the background).
// iOS shows them only for apps added to the Home Screen (16.4+); permission must be
// requested from a tap (the Settings screen calls requestTimerNotifications()).

import { withBasePath } from "@/lib/basePath";

export type TimerNotificationStatus = NotificationPermission | "unsupported";

export function timerNotificationStatus(): TimerNotificationStatus {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Shows the permission prompt (call from a tap) and resolves to the resulting status. */
export async function requestTimerNotifications(): Promise<TimerNotificationStatus> {
  if (timerNotificationStatus() === "unsupported") return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result ?? timerNotificationStatus();
  } catch {
    // Old Safari only has the callback form; the current value is still readable.
    return timerNotificationStatus();
  }
}

export interface TimerNotification {
  /** One notification per timer: a repeat replaces the previous one. */
  tag: string;
  title: string;
  body: string;
  /** Opened when the notification is tapped (already includes the base path). */
  url: string;
  /** Page-level fallback click handler (when there is no service worker). */
  onClick?: () => void;
}

async function activeRegistration(timeoutMs: number): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // `ready` never settles without a registered worker, so check first and race a timeout.
    if (!(await navigator.serviceWorker.getRegistration())) return null;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

/** Returns true when a notification was shown. */
export async function showTimerNotification({ tag, title, body, url, onClick }: TimerNotification): Promise<boolean> {
  if (timerNotificationStatus() !== "granted") return false;
  const options: NotificationOptions = {
    body,
    tag,
    data: { url },
    icon: withBasePath("/icons/icon-192.png"),
    badge: withBasePath("/icons/icon-192.png"),
    requireInteraction: true,
  };
  const registration = await activeRegistration(1500);
  if (registration) {
    try {
      await registration.showNotification(title, options);
      return true;
    } catch {
      // Fall through to the page-level API.
    }
  }
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
    return true;
  } catch {
    // Android Chrome only allows notifications through a service worker.
    return false;
  }
}
