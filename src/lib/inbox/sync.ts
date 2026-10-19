// Turns recipes waiting on the Gemini relay into vault recipes. Each one goes through the same
// parser and sanitiser as Paste & save. A recipe whose title is already in the vault updates
// that recipe (its cook history stays); every outcome can be undone.

import {
  createRecipe,
  deleteRecipe,
  findRecipeByTitle,
  restoreRecipeSnapshot,
  snapshotRecipe,
  updateRecipe,
  type RecipeSnapshot,
} from "@/lib/db";
import { parseRecipeText } from "@/lib/parser/parseRecipe";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { Recipe } from "@/lib/types";
import type { InboxClient, InboxItem } from "./client";

/** What normalizeRecipeDraft calls a recipe without a title. */
const UNTITLED = "Untitled recipe";

export type InboxOutcome =
  | { kind: "created"; itemId: string; recipe: Recipe; warning?: string }
  | { kind: "updated"; itemId: string; recipe: Recipe; previous: RecipeSnapshot; warning?: string }
  | { kind: "unreadable"; itemId: string; text: string };

/** Relay item ids already imported on this device. */
export interface ProcessedIds {
  has(id: string): boolean;
  add(id: string): void;
}

export async function importInboxItem(item: InboxItem): Promise<InboxOutcome> {
  const { draft, warnings } = parseRecipeText(item.text);
  if (draft.ingredients.length === 0 && draft.steps.length === 0) {
    return { kind: "unreadable", itemId: item.id, text: item.text };
  }
  const warning = warnings[0];
  // Untitled recipes never match each other: they are different dishes.
  const existing = draft.title === UNTITLED ? undefined : await findRecipeByTitle(draft.title);
  const previous = existing ? await snapshotRecipe(existing.id) : null;
  if (existing && previous) {
    // The match ignores case; keep the vault's spelling so an update never renames the recipe.
    const recipe = await updateRecipe(existing.id, { ...draft, title: existing.title });
    return { kind: "updated", itemId: item.id, recipe, previous, ...(warning ? { warning } : {}) };
  }
  const recipe = await createRecipe(draft);
  return { kind: "created", itemId: item.id, recipe, ...(warning ? { warning } : {}) };
}

/**
 * Pulls the inbox, imports every item not imported before (oldest first), then acknowledges all
 * handled items so the relay deletes them. A failed acknowledgement is retried on the next sync;
 * `processed` keeps that from importing anything twice.
 */
export async function syncInbox(client: InboxClient, processed: ProcessedIds): Promise<InboxOutcome[]> {
  const items = await client.list();
  const outcomes: InboxOutcome[] = [];
  const handled: string[] = [];
  try {
    for (const item of items) {
      if (!processed.has(item.id)) {
        outcomes.push(await importInboxItem(item));
        processed.add(item.id);
      }
      handled.push(item.id);
    }
  } finally {
    try {
      if (handled.length > 0) await client.ack(handled);
    } catch {
      // Offline or relay hiccup: the next sync acknowledges them again.
    }
  }
  return outcomes;
}

export async function undoInboxOutcome(outcome: InboxOutcome): Promise<void> {
  if (outcome.kind === "created") await deleteRecipe(outcome.recipe.id);
  else if (outcome.kind === "updated") await restoreRecipeSnapshot(outcome.previous);
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Processed ids in localStorage, newest last, capped (the relay deletes acknowledged items anyway). */
export function createProcessedIds(storage: KeyValueStorage, limit = 200): ProcessedIds {
  const key = STORAGE_KEYS.inboxProcessed;
  const read = (): string[] => {
    try {
      const value: unknown = JSON.parse(storage.getItem(key) ?? "[]");
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  };
  return {
    has: (id) => read().includes(id),
    add: (id) => {
      const next = [...read().filter((x) => x !== id), id].slice(-limit);
      try {
        storage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage full or blocked: worst case a lost acknowledgement re-imports one recipe (as an update).
      }
    },
  };
}
