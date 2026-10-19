// Domain model for CulinaryLog. Every persisted record is plain, JSON-friendly data
// (photos excepted: their bytes are ArrayBuffers), so backups are a direct dump.

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Per-serving nutrition. `null` means "unknown", which is different from 0. */
export interface Macros {
  calories: number | null; // kcal
  protein: number | null; // g
  carbs: number | null; // g
  fat: number | null; // g
}

export interface Ingredient {
  id: string;
  /** Free text exactly as written, e.g. "750 g chicken, bone-in curry cut". */
  text: string;
  /** Optional sub-heading this item sits under, e.g. "For the marinade". */
  group?: string;
}

export interface Step {
  id: string;
  /**
   * Instruction text. May contain `**bold**` and duration phrases such as
   * "14 mins" or "1 hr 30 min"; the UI turns those into tap-to-start timers.
   */
  text: string;
  /** Optional sub-heading, e.g. "Dum". */
  group?: string;
}

export interface Recipe {
  id: string;
  title: string;
  /** Short summary shown under the title; "" when absent. */
  description: string;
  /** Free-form categories, e.g. ["High-Protein", "Biryani", "Dinner"]. */
  categories: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  macros: Macros;
  ingredients: Ingredient[];
  steps: Step[];
  /** Notes & tips. Plain text; lines starting with "- " render as bullets. */
  notes: string;
  /** Where the recipe came from (URL or text); "" when absent. */
  source: string;
  favorite: boolean;
  /** Set on built-in starter recipes so they can be restored after deletion. */
  seedKey?: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

/** Everything the editor/importer produces; ids and timestamps are assigned on save. */
export interface RecipeDraft {
  title: string;
  description: string;
  categories: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  macros: Macros;
  /** Ingredient/step ids are optional in drafts; missing ones are generated on save. */
  ingredients: Array<Omit<Ingredient, "id"> & { id?: string }>;
  steps: Array<Omit<Step, "id"> & { id?: string }>;
  notes: string;
  source: string;
  favorite?: boolean;
  seedKey?: string;
}

export interface CookLog {
  id: string;
  /** Local calendar day the dish was cooked, "YYYY-MM-DD". */
  date: string;
  mealType: MealType;
  /** Linked vault recipe, or null for a custom dish (or a recipe that was deleted). */
  recipeId: string | null;
  /** Recipe title snapshot at log time, or the custom dish name. Always set. */
  dishName: string;
  /** Tweaks / notes, e.g. "Air fried birista for 14 mins, extra pepper". */
  notes: string;
  photoId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CookLogInput {
  date: string;
  mealType: MealType;
  recipeId: string | null;
  dishName: string;
  notes: string;
}

/** A compressed plate photo. Stored apart from logs so list queries stay light. */
export interface Photo {
  id: string;
  logId: string;
  mime: string; // "image/jpeg"
  data: ArrayBuffer; // longest edge ≤ 1600 px
  thumb: ArrayBuffer; // longest edge ≤ 480 px
  width: number;
  height: number;
  createdAt: number;
}

/** Photo bytes produced by the image pipeline, before they are tied to a log. */
export interface PhotoInput {
  mime: string;
  data: ArrayBuffer;
  thumb: ArrayBuffer;
  width: number;
  height: number;
}

/** Per-recipe "while cooking" progress: ticked ingredients and finished steps. */
export interface CookState {
  recipeId: string;
  checkedIngredientIds: string[];
  doneStepIds: string[];
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

/** Aggregates derived from the cook log, keyed by recipe id. */
export interface RecipeStats {
  count: number;
  lastDate: string | null;
  /** Most recent plate photo logged for this recipe, used as the card cover. */
  coverPhotoId: string | null;
}

export const EMPTY_MACROS: Macros = { calories: null, protein: null, carbs: null, fat: null };
