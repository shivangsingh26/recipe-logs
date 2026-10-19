// "While cooking" progress per recipe: ticked ingredients and finished steps.
// Persisted so a reload (or the phone locking) mid-cook loses nothing.

import { useLiveQuery } from "dexie-react-hooks";
import type { CookState } from "@/lib/types";
import { db } from "./db";

function emptyState(recipeId: string): CookState {
  return { recipeId, checkedIngredientIds: [], doneStepIds: [], updatedAt: 0 };
}

/** Live cooking progress for a recipe (empty state while loading or when none exists). */
export function useCookState(recipeId: string | null | undefined): CookState {
  const state = useLiveQuery(() => (recipeId ? db.cookState.get(recipeId) : undefined), [recipeId]);
  return state ?? emptyState(recipeId ?? "");
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

async function mutate(recipeId: string, fn: (s: CookState) => CookState): Promise<void> {
  await db.transaction("rw", db.cookState, async () => {
    const current = (await db.cookState.get(recipeId)) ?? emptyState(recipeId);
    await db.cookState.put({ ...fn(current), updatedAt: Date.now() });
  });
}

export function toggleIngredientChecked(recipeId: string, ingredientId: string): Promise<void> {
  return mutate(recipeId, (s) => ({ ...s, checkedIngredientIds: toggle(s.checkedIngredientIds, ingredientId) }));
}

export function toggleStepDone(recipeId: string, stepId: string): Promise<void> {
  return mutate(recipeId, (s) => ({ ...s, doneStepIds: toggle(s.doneStepIds, stepId) }));
}

export async function resetCookState(recipeId: string): Promise<void> {
  await db.cookState.delete(recipeId);
}
