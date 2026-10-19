// Screen Wake Lock: keeps the phone screen on while cooking (timers running, cook mode).
// Supported in Chrome/Android and iOS Safari 16.4+ (home-screen apps from iOS 18.4).
// The lock is dropped by the browser whenever the page is hidden, so it is
// re-acquired on visibilitychange.

import { useEffect, useState } from "react";

export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/** Holds a screen wake lock while `active` is true. Returns whether a lock is currently held. */
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !isWakeLockSupported()) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void next.release();
          return;
        }
        sentinel = next;
        setHeld(true);
        next.addEventListener("release", () => setHeld(false));
      } catch {
        // Denied (battery saver, not visible, unsupported in this context): fail quietly.
        setHeld(false);
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      if (sentinel && !sentinel.released) void sentinel.release();
      setHeld(false);
    };
  }, [active]);

  return held;
}
