// Chromium's "Install app" prompt. The browser fires `beforeinstallprompt` once per page
// load, often before React hydrates, so the event is captured as soon as the app's JS
// runs (see ServiceWorkerRegistrar) and kept here until Settings offers "Install app".

import { useSyncExternalStore } from "react";

/** Not in lib.dom: Chromium-only. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface InstallPromptState {
  /** The browser handed us an install prompt that can be shown from a tap. */
  available: boolean;
  /** The app was installed during this visit. */
  installed: boolean;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

const INITIAL: InstallPromptState = { available: false, installed: false };

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallPromptState = INITIAL;
let capturing = false;
const listeners = new Set<() => void>();

function update(patch: Partial<InstallPromptState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** Starts listening for the install prompt. Idempotent; a no-op outside the browser. */
export function captureInstallPrompt(): void {
  if (capturing || typeof window === "undefined") return;
  capturing = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Skip the browser's own mini-infobar; Settings offers "Install app" instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    update({ available: true });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    update({ available: false, installed: true });
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallPrompt(): InstallPromptState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

/** Opens the browser's install dialog. Call from a tap; each prompt can be used once. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  update({ available: false });
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") update({ installed: true });
    return outcome;
  } catch {
    return "unavailable";
  }
}
