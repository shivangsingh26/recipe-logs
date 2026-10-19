// Timer alert permission. Stand-in until the timers slice ships
// requestTimerNotifications() / timerNotificationStatus() in "@/lib/timers/notify":
// feature-detects the Notification API and asks for permission directly.

import { useSyncExternalStore } from "react";

export type NotificationStatus = NotificationPermission | "unsupported";

const listeners = new Set<() => void>();

function readStatus(): NotificationStatus {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

// The permission can also change in the system settings while the app is in the background.
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    listeners.delete(listener);
    document.removeEventListener("visibilitychange", listener);
  };
}

export function useNotificationStatus(): NotificationStatus {
  return useSyncExternalStore(subscribe, readStatus, () => "unsupported");
}

/** Shows the permission prompt (call from a tap). Resolves to the resulting status. */
export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (readStatus() === "unsupported") return "unsupported";
  try {
    await Notification.requestPermission();
  } catch {
    // Very old Safari only supports the callback form; the status re-read below still works.
  }
  listeners.forEach((listener) => listener());
  return readStatus();
}
