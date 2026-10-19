// Per-serving nutrition helpers (Atwater factors: protein and carbs 4 kcal/g, fat 9 kcal/g).

import type { Macros } from "@/lib/types";

export function hasAnyMacro(macros: Macros): boolean {
  return macros.calories != null || macros.protein != null || macros.carbs != null || macros.fat != null;
}

function energy(macros: Macros): { protein: number; carbs: number; fat: number } | null {
  const { protein, carbs, fat } = macros;
  if (protein == null || carbs == null || fat == null) return null;
  return { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 };
}

/** kcal implied by protein/carbs/fat, rounded; null unless all three are known (and non-zero). */
export function caloriesFromMacros(macros: Macros): number | null {
  const e = energy(macros);
  if (!e) return null;
  const total = Math.round(e.protein + e.carbs + e.fat);
  return total > 0 ? total : null;
}

/** Fractions (summing to 1) of energy from each macro. */
export interface CalorieShare {
  protein: number;
  carbs: number;
  fat: number;
}

/** Where the calories come from; null unless protein, carbs and fat are all known. */
export function calorieShare(macros: Macros): CalorieShare | null {
  const e = energy(macros);
  if (!e) return null;
  const total = e.protein + e.carbs + e.fat;
  if (total <= 0) return null;
  return { protein: e.protein / total, carbs: e.carbs / total, fat: e.fat / total };
}
