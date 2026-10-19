"use client";

import { useCallback, useEffect, useState } from "react";

export interface StorageInfo {
  /** Bytes this site stores (IndexedDB, caches …), null while loading or unsupported. */
  usage: number | null;
  /** Whether the browser promised not to evict this site's data; null = unknown/unsupported. */
  persisted: boolean | null;
  /** Asks for persistent storage (call from a tap). Resolves to whether it was granted. */
  persist: () => Promise<boolean>;
}

/** navigator.storage details; re-measured whenever `refreshKey` changes (e.g. record counts). */
export function useStorageInfo(refreshKey: string): StorageInfo {
  const [usage, setUsage] = useState<number | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (!storage) return;
    let cancelled = false;
    void Promise.all([
      typeof storage.estimate === "function" ? storage.estimate().catch(() => null) : null,
      typeof storage.persisted === "function" ? storage.persisted().catch(() => null) : null,
    ]).then(([estimate, isPersisted]) => {
      if (cancelled) return;
      setUsage(estimate?.usage ?? null);
      setPersisted(isPersisted);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const persist = useCallback(async () => {
    if (typeof navigator.storage?.persist !== "function") return false;
    const granted = await navigator.storage.persist().catch(() => false);
    setPersisted(granted);
    return granted;
  }, []);

  return { usage, persisted, persist };
}
