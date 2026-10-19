// Record sanitisers for restore. Backup files are untrusted (hand-edited, truncated,
// from another version), so every record is rebuilt from scratch through the shared
// normalisers; ids and timestamps are kept when they are valid.

import { cleanLine, normalizeLogInput, normalizeRecipeDraft, withItemIds } from "@/lib/db";
import { isDateKey } from "@/lib/dates";
import { newId } from "@/lib/ids";
import type { CookLog, CookState, Recipe } from "@/lib/types";

type Loose = Record<string, unknown>;

export function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ID_RE = /^[\w.:-]{1,128}$/;

export function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return ID_RE.test(id) ? id : null;
}

/** Epoch milliseconds within the range a Date can represent. */
export function cleanTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 8.64e15 ? Math.round(value) : null;
}

/** Normalised recipe, keeping its id (or minting one) and timestamps. Null for non-objects. */
export function sanitizeRecipe(raw: unknown, now: number): Recipe | null {
  if (!isRecord(raw)) return null;
  const draft = normalizeRecipeDraft(raw);
  const createdAt = cleanTimestamp(raw.createdAt) ?? now;
  return {
    id: cleanId(raw.id) ?? newId(),
    title: draft.title,
    description: draft.description,
    categories: draft.categories,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    servings: draft.servings,
    macros: draft.macros,
    ...withItemIds(draft),
    notes: draft.notes,
    source: draft.source,
    favorite: draft.favorite ?? false,
    ...(draft.seedKey ? { seedKey: draft.seedKey } : {}),
    createdAt,
    updatedAt: cleanTimestamp(raw.updatedAt) ?? createdAt,
  };
}

/**
 * Normalised log entry. Null when it has no usable id or date: guessing a date would
 * put the dish on the wrong day. A missing dish name falls back to the recipe's title.
 */
export function sanitizeLog(raw: unknown, now: number, recipeTitle?: (id: string) => string | undefined): CookLog | null {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id);
  if (!id || !isDateKey(raw.date)) return null;
  const recipeId = cleanId(raw.recipeId);
  const fallbackName = recipeId ? recipeTitle?.(recipeId) : undefined;
  const input = normalizeLogInput({
    ...raw,
    recipeId,
    dishName: cleanLine(raw.dishName, 200) || fallbackName,
  });
  const createdAt = cleanTimestamp(raw.createdAt) ?? now;
  return {
    id,
    ...input,
    photoId: cleanId(raw.photoId),
    createdAt,
    updatedAt: cleanTimestamp(raw.updatedAt) ?? createdAt,
  };
}

/** Photo metadata as it appears in a backup (bytes are resolved separately). */
export interface PhotoMeta {
  id: string;
  logId: string;
  mime: string;
  width: number;
  height: number;
  createdAt: number;
}

function cleanDimension(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 100_000 ? Math.round(value) : 0;
}

export function sanitizePhotoMeta(raw: unknown, now: number): PhotoMeta | null {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id);
  const logId = cleanId(raw.logId);
  if (!id || !logId) return null;
  const mime = typeof raw.mime === "string" && /^image\/[\w.+-]+$/i.test(raw.mime) ? raw.mime.toLowerCase() : "image/jpeg";
  return {
    id,
    logId,
    mime,
    width: cleanDimension(raw.width),
    height: cleanDimension(raw.height),
    createdAt: cleanTimestamp(raw.createdAt) ?? now,
  };
}

function cleanIdList(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.map(cleanId).filter((id): id is string => id !== null && allowed.has(id));
  return [...new Set(ids)];
}

/** Cooking progress, limited to ingredient/step ids that exist in the recipe. */
export function sanitizeCookState(raw: unknown, recipe: Recipe): CookState {
  const r = isRecord(raw) ? raw : {};
  return {
    recipeId: recipe.id,
    checkedIngredientIds: cleanIdList(r.checkedIngredientIds, new Set(recipe.ingredients.map((i) => i.id))),
    doneStepIds: cleanIdList(r.doneStepIds, new Set(recipe.steps.map((s) => s.id))),
    updatedAt: cleanTimestamp(r.updatedAt) ?? 0,
  };
}
