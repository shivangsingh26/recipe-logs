// Hand-off of a parsed (not yet saved) recipe from the importer to the editor.
// sessionStorage keeps it across the navigation and a reload, but not forever.

import { normalizeRecipeDraft } from "@/lib/db/normalize";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { RecipeDraft } from "@/lib/types";

const KEY = STORAGE_KEYS.importDraft;

export interface StashedDraft {
  draft: RecipeDraft;
  /** Parser warnings to show above the editor (e.g. "No steps found"). */
  warnings: string[];
}

export function stashDraft(draft: RecipeDraft, warnings: string[] = []): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ draft, warnings } satisfies StashedDraft));
  } catch {
    // Storage blocked: the editor will simply open empty.
  }
}

/** Reads the stashed draft without removing it (safe under React StrictMode double effects). */
export function peekDraft(): StashedDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StashedDraft>;
    return {
      draft: normalizeRecipeDraft(parsed.draft),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((w): w is string => typeof w === "string") : [],
    };
  } catch {
    return null;
  }
}

/** Call after the draft was saved or discarded. */
export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
