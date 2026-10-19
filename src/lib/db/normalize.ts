// Sanitisers shared by the editor, the importer and backup restore. They accept
// untrusted shapes (parsed text, old/hand-edited backup files) and always return
// well-formed records, so nothing malformed ever reaches IndexedDB.

import { cleanCategory, mergeCategories } from "@/lib/categories";
import { defaultMealForTime, isDateKey, todayKey } from "@/lib/dates";
import { newId } from "@/lib/ids";
import {
  MEAL_TYPES,
  type CookLogInput,
  type Ingredient,
  type Macros,
  type MealType,
  type Recipe,
  type RecipeDraft,
  type Step,
} from "@/lib/types";

type Loose = Record<string, unknown>;

function asObject(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

/** Trimmed string with normalised newlines; non-strings become "". */
export function cleanText(value: unknown, maxLength = 20_000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

/** Single-line text (newlines/tabs collapsed to spaces). */
export function cleanLine(value: unknown, maxLength = 500): string {
  return cleanText(value, maxLength * 2)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Finite number within [min, max], rounded to 1 decimal; anything else → null. */
export function cleanNumber(value: unknown, max = 100_000, min = 0): number | null {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") n = Number(value.trim().replace(",", "."));
  else return null;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

export function cleanMacros(value: unknown): Macros {
  const m = asObject(value);
  return {
    calories: cleanNumber(m.calories, 20_000),
    protein: cleanNumber(m.protein, 5_000),
    carbs: cleanNumber(m.carbs, 5_000),
    fat: cleanNumber(m.fat, 5_000),
  };
}

function cleanItems<T extends { id?: string; text: string; group?: string }>(
  value: unknown,
  multiline: boolean,
): Array<Omit<T, "id"> & { id?: string }> {
  if (!Array.isArray(value)) return [];
  const out: Array<Omit<T, "id"> & { id?: string }> = [];
  for (const raw of value) {
    const item = typeof raw === "string" ? { text: raw } : asObject(raw);
    const text = multiline ? cleanText(item.text, 5_000) : cleanLine(item.text, 1_000);
    if (!text) continue;
    const group = cleanLine(item.group, 120);
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 64) : undefined;
    out.push({ text, ...(group ? { group } : {}), ...(id ? { id } : {}) } as Omit<T, "id"> & { id?: string });
  }
  return out;
}

/** Coerces any recipe-ish object into a valid draft. */
export function normalizeRecipeDraft(input: unknown): RecipeDraft {
  const r = asObject(input);
  const categories = Array.isArray(r.categories)
    ? mergeCategories(r.categories.filter((c): c is string => typeof c === "string").map(cleanCategory))
    : [];
  const draft: RecipeDraft = {
    title: cleanLine(r.title, 200) || "Untitled recipe",
    description: cleanText(r.description, 2_000),
    categories,
    prepMinutes: cleanNumber(r.prepMinutes, 10_000),
    cookMinutes: cleanNumber(r.cookMinutes, 10_000),
    servings: cleanNumber(r.servings, 1_000),
    macros: cleanMacros(r.macros),
    ingredients: cleanItems<Ingredient>(r.ingredients, false),
    steps: cleanItems<Step>(r.steps, true),
    notes: cleanText(r.notes, 20_000),
    source: cleanLine(r.source, 2_000),
  };
  if (typeof r.favorite === "boolean") draft.favorite = r.favorite;
  if (typeof r.seedKey === "string" && r.seedKey.trim()) draft.seedKey = r.seedKey.trim().slice(0, 80);
  return draft;
}

/** Gives every ingredient/step a unique id, keeping existing ids where possible. */
export function withItemIds(draft: RecipeDraft): Pick<Recipe, "ingredients" | "steps"> {
  const used = new Set<string>();
  const assign = <T extends { id?: string; text: string; group?: string }>(items: T[]) =>
    items.map((item) => {
      let id = item.id && !used.has(item.id) ? item.id : newId();
      while (used.has(id)) id = newId();
      used.add(id);
      return { id, text: item.text, ...(item.group ? { group: item.group } : {}) };
    });
  return { ingredients: assign(draft.ingredients), steps: assign(draft.steps) };
}

/** Converts a stored recipe back into an editable draft (ids preserved). */
export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description,
    categories: [...recipe.categories],
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    servings: recipe.servings,
    macros: { ...recipe.macros },
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
    steps: recipe.steps.map((s) => ({ ...s })),
    notes: recipe.notes,
    source: recipe.source,
    favorite: recipe.favorite,
    ...(recipe.seedKey ? { seedKey: recipe.seedKey } : {}),
  };
}

export function emptyRecipeDraft(): RecipeDraft {
  return normalizeRecipeDraft({ title: "" });
}

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
}

export function normalizeLogInput(input: unknown): CookLogInput {
  const l = asObject(input);
  const recipeId = typeof l.recipeId === "string" && l.recipeId.trim() ? l.recipeId.trim() : null;
  return {
    date: isDateKey(l.date) ? l.date : todayKey(),
    mealType: isMealType(l.mealType) ? l.mealType : defaultMealForTime(),
    recipeId,
    dishName: cleanLine(l.dishName, 200) || "Untitled dish",
    notes: cleanText(l.notes, 5_000),
  };
}
