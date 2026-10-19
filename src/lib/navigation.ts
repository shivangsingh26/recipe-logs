"use client";

// Tracks whether there is in-app history to go back to. A PWA launched from the home
// screen (or a deep link) starts with no history, so "Back" must fall back to a parent.

import { useRouter } from "next/navigation";
import { useCallback } from "react";

let inAppNavigations = 0;

/** Called by <NavigationTracker> on every client-side route change. */
export function recordNavigation(): void {
  inAppNavigations += 1;
}

/** Returns a function that goes back when possible, else navigates to `fallbackHref`. */
export function useBack(fallbackHref: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (inAppNavigations > 1 && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }, [router, fallbackHref]);
}
