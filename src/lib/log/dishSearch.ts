// Dish picker search: case- and accent-insensitive matching on recipe titles and categories.

export interface SearchableRecipe {
  title: string;
  categories: readonly string[];
}

/** "  Crème Brûlée " → "creme brulee". */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function everyTokenStartsAWord(title: string, tokens: readonly string[]): boolean {
  const words = title.split(/[^\p{L}\p{N}]+/u);
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

/**
 * Recipes matching every word of `query` (in the title or a category), best first:
 * exact title, title prefix, word prefixes, title substring, then category-only matches.
 */
export function searchRecipes<T extends SearchableRecipe>(recipes: readonly T[], query: string, limit = 6): T[] {
  const q = foldText(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const scored: Array<{ recipe: T; score: number }> = [];
  for (const recipe of recipes) {
    const title = foldText(recipe.title);
    const categories = recipe.categories.map(foldText).join(" | ");
    if (!tokens.every((t) => title.includes(t) || categories.includes(t))) continue;
    let score = 4;
    if (title === q) score = 0;
    else if (title.startsWith(q)) score = 1;
    else if (everyTokenStartsAWord(title, tokens)) score = 2;
    else if (tokens.every((t) => title.includes(t))) score = 3;
    scored.push({ recipe, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.recipe.title.localeCompare(b.recipe.title))
    .slice(0, Math.max(0, limit))
    .map((s) => s.recipe);
}

/** The recipe whose title equals `query` (ignoring case/accents/spacing), if any. */
export function findExactRecipe<T extends SearchableRecipe>(recipes: readonly T[], query: string): T | undefined {
  const q = foldText(query);
  return q ? recipes.find((r) => foldText(r.title) === q) : undefined;
}
