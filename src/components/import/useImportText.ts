"use client";

// The importer's textarea content, kept in sessionStorage so switching tabs or apps
// mid-paste never loses a long recipe. An external store (not component state) so the
// first client render can read it without a hydration mismatch.

import { useSyncExternalStore } from "react";

// TODO(foundation): move to STORAGE_KEYS.importText in src/lib/storageKeys.ts.
export const IMPORT_TEXT_STORAGE_KEY = "culinarylog:import-text:v1";

let cache: string | null = null;
const listeners = new Set<() => void>();

function read(): string {
  if (cache == null) {
    try {
      cache = window.sessionStorage.getItem(IMPORT_TEXT_STORAGE_KEY) ?? "";
    } catch {
      cache = "";
    }
  }
  return cache;
}

export function setImportText(value: string): void {
  cache = value;
  try {
    if (value) window.sessionStorage.setItem(IMPORT_TEXT_STORAGE_KEY, value);
    else window.sessionStorage.removeItem(IMPORT_TEXT_STORAGE_KEY);
  } catch {
    // Storage blocked or full: the text still lives in memory for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useImportText(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
