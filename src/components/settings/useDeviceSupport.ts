// Browser feature checks for the Settings screen, read once on the client.

import { useSyncExternalStore } from "react";

export interface DeviceSupport {
  vibrate: boolean;
  wakeLock: boolean;
  storageEstimate: boolean;
}

// Prerendered HTML assumes an iPhone (no vibration, has Wake Lock) so the most common
// device doesn't see rows appear or change once the page hydrates.
const PRERENDER: DeviceSupport = { vibrate: false, wakeLock: true, storageEstimate: true };

let cached: DeviceSupport | null = null;

function read(): DeviceSupport {
  cached ??= {
    vibrate: typeof navigator.vibrate === "function",
    wakeLock: "wakeLock" in navigator,
    storageEstimate: typeof navigator.storage?.estimate === "function",
  };
  return cached;
}

const noopSubscribe = () => () => {};

export function useDeviceSupport(): DeviceSupport {
  return useSyncExternalStore(noopSubscribe, read, () => PRERENDER);
}

/** False in prerendered HTML and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
