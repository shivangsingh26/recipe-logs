"use client";

// Registers the service worker in production builds and offers "Update available" when a
// new version has installed. The new worker waits until the person taps Reload, so an
// update never swaps the app's files out from under an open recipe or a running timer.

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/basePath";
import { db } from "@/lib/db";
import { captureInstallPrompt } from "./installPrompt";
import { isStandalone } from "./platform";

// Runs when the app's JS first loads, before hydration, so the early install prompt isn't missed.
captureInstallPrompt();

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_TOAST_ID = "app-update";
/** `settings` table row recording that persistent storage was requested on this device. */
const PERSIST_REQUESTED_KEY = "persistRequestedAt";

/**
 * Installed apps ask once per device for storage the browser won't evict under pressure.
 * Later attempts are left to the "Protect from clean-up" button in Settings.
 */
async function requestPersistenceOnce(): Promise<void> {
  if (!isStandalone() || typeof navigator.storage?.persist !== "function") return;
  try {
    if (await db.settings.get(PERSIST_REQUESTED_KEY)) return;
    await db.settings.put({ key: PERSIST_REQUESTED_KEY, value: Date.now() });
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Best effort: the Settings screen shows the current status.
  }
}

export function ServiceWorkerRegistrar() {
  const toast = useToast();

  useEffect(() => {
    void requestPersistenceOnce();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    let registration: ServiceWorkerRegistration | null = null;
    let reloadRequested = false;
    let lastCheckAt = Date.now();
    let disposed = false;

    const offerUpdate = () => {
      toast.show({
        id: UPDATE_TOAST_ID,
        title: "Update available",
        description: "Reload to get the latest version.",
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            reloadRequested = true;
            const waiting = registration?.waiting;
            // Another tab may already have activated it: then a plain reload is enough.
            if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
            else window.location.reload();
          },
        },
      });
    };

    const watchInstalling = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        // With no controller this is the first install: nothing to update from.
        if (worker.state === "installed" && container.controller) offerUpdate();
      });
    };

    const onControllerChange = () => {
      if (!reloadRequested) return;
      reloadRequested = false;
      window.location.reload();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      if (Date.now() - lastCheckAt < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheckAt = Date.now();
      registration.update().catch(() => {
        // Offline or the server is unreachable: try again on a later visit.
      });
    };

    container.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    container
      .register(withBasePath("/sw.js"), { scope: withBasePath("/"), updateViaCache: "none" })
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        if (reg.waiting && container.controller) offerUpdate();
        watchInstalling(reg.installing);
        reg.addEventListener("updatefound", () => watchInstalling(reg.installing));
      })
      .catch(() => {
        // e.g. plain http:// on a LAN address: the app still works, just not offline.
      });

    return () => {
      disposed = true;
      container.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [toast]);

  return null;
}
