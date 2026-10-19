import { useSyncExternalStore } from "react";
import { todayKey } from "@/lib/dates";

function msUntilNextDay(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

function subscribe(onChange: () => void): () => void {
  let timer = window.setTimeout(function tick() {
    onChange();
    timer = window.setTimeout(tick, msUntilNextDay());
  }, msUntilNextDay());
  // Timers stall while an installed PWA sits in the background; re-check when it returns.
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onChange);
  };
}

const serverSnapshot = () => null;

/** Today's local date key, kept current across midnight; null while prerendering/hydrating. */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, () => todayKey(), serverSnapshot);
}
