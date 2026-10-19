// Categories are free-form strings on each recipe. These helpers keep them tidy:
// "high protein", "High-Protein" and "HIGH PROTEIN" are the same category.

import type { Macros } from "./types";

export const DEFAULT_CATEGORIES: readonly string[] = [
  "High-Protein",
  "Biryani",
  "Quick Meal",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Curry",
  "Low-Carb",
  "Vegetarian",
  "Air Fryer",
  "Meal Prep",
];

/** Comparison key: case-, space- and punctuation-insensitive. */
export function categoryKey(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Trims and collapses whitespace; returns "" for blank input. */
export function cleanCategory(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 40);
}

/**
 * Merges category lists, dropping blanks and duplicates (by `categoryKey`).
 * The first spelling seen wins, so pass the canonical list first.
 */
export function mergeCategories(...lists: ReadonlyArray<readonly string[]>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const clean = cleanCategory(raw);
      const key = categoryKey(clean);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

/** Re-spells categories to match an existing vocabulary (e.g. "high protein" → "High-Protein"). */
export function canonicalizeCategories(categories: readonly string[], vocabulary: readonly string[]): string[] {
  const byKey = new Map(vocabulary.map((c) => [categoryKey(c), c] as const));
  return mergeCategories(categories.map((c) => byKey.get(categoryKey(c)) ?? c));
}

export function hasCategory(categories: readonly string[], category: string): boolean {
  const key = categoryKey(category);
  return categories.some((c) => categoryKey(c) === key);
}

interface SuggestInput {
  title: string;
  ingredients: ReadonlyArray<{ text: string }>;
  steps?: ReadonlyArray<{ text: string }>;
  macros: Macros;
  prepMinutes: number | null;
  cookMinutes: number | null;
}

/**
 * Heuristic category suggestions for a new/imported recipe. Conservative on purpose:
 * only rules that are rarely wrong.
 */
export function suggestCategories(input: SuggestInput): string[] {
  const title = input.title.toLowerCase();
  const body = [title, ...input.ingredients.map((i) => i.text), ...(input.steps ?? []).map((s) => s.text)]
    .join("\n")
    .toLowerCase();
  const out: string[] = [];

  if (/\bbiry?ani\b/.test(title)) out.push("Biryani");
  if (/\bcurry\b|\bmasala\b|\bkorma\b|\btikka masala\b/.test(title)) out.push("Curry");
  if (/\bair[- ]?fr(y|ied|yer)\b/.test(body)) out.push("Air Fryer");

  const { protein, calories, carbs } = input.macros;
  if (protein != null && (protein >= 30 || (calories != null && calories > 0 && (protein * 4) / calories >= 0.3))) {
    out.push("High-Protein");
  }
  if (carbs != null && carbs <= 20 && calories != null && calories >= 150) out.push("Low-Carb");

  const total = (input.prepMinutes ?? 0) + (input.cookMinutes ?? 0);
  if (input.prepMinutes != null && input.cookMinutes != null && total > 0 && total <= 30) out.push("Quick Meal");

  return out;
}
