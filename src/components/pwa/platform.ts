// Where the app is running: which install instructions apply, and whether it already
// runs as an installed (home-screen) app. The pure helpers take their inputs for tests.

import { useSyncExternalStore } from "react";

export type InstallPlatform = "ios" | "android" | "other";

/** iPadOS 13+ reports a desktop Mac user agent; multi-touch gives it away. */
export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

const STANDALONE_QUERY = "(display-mode: standalone)";

/** True when launched from the home screen / as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari only exposes the non-standard navigator.standalone for home-screen apps.
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia(STANDALONE_QUERY).matches;
}

function subscribeStandalone(onChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Reactive isStandalone(); false while prerendering. */
export function useStandalone(): boolean {
  return useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
}

const noopSubscribe = () => () => {};

function currentPlatform(): InstallPlatform {
  return detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
}

/** The install platform of this browser; "other" while prerendering. */
export function useInstallPlatform(): InstallPlatform {
  return useSyncExternalStore(noopSubscribe, currentPlatform, () => "other");
}
