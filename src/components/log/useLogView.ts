import { useSyncExternalStore } from "react";

export type LogView = "calendar" | "timeline";

/** localStorage: the Cook Log view last chosen on this device. */
export const LOG_VIEW_STORAGE_KEY = "culinarylog:log-view:v1";

const listeners = new Set<() => void>();
// Used when storage is blocked (private mode), so switching still works for the session.
let memory: LogView | null = null;

function parse(value: string | null): LogView {
  return value === "timeline" ? "timeline" : "calendar";
}

function read(): LogView {
  if (memory) return memory;
  try {
    return parse(window.localStorage.getItem(LOG_VIEW_STORAGE_KEY));
  } catch {
    return "calendar";
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LOG_VIEW_STORAGE_KEY) return;
    memory = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setLogView(view: LogView): void {
  memory = view;
  try {
    window.localStorage.setItem(LOG_VIEW_STORAGE_KEY, view);
  } catch {
    // Storage blocked or full: the in-memory value still applies.
  }
  listeners.forEach((l) => l());
}

/** Calendar/Timeline choice, remembered per device. */
export function useLogView(): LogView {
  return useSyncExternalStore(subscribe, read, () => "calendar");
}
