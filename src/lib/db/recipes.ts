// Recipe vault mutations. Reads go through the live hooks in ./hooks.ts.

import { buildSeedRecipes, SEED_RECIPES } from "@/lib/seeds";
import { newId } from "@/lib/ids";
import type { CookState, Recipe, RecipeDraft } from "@/lib/types";
import { db } from "./db";
import { normalizeRecipeDraft, withItemIds } from "./normalize";

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id);
}

/** Case-insensitive exact title match (used to update a re-imported recipe instead of duplicating it). */
export async function findRecipeByTitle(title: string): Promise<Recipe | undefined> {
  const wanted = title.trim();
  if (!wanted) return undefined;
  return db.recipes.where("title").equalsIgnoreCase(wanted).first();
}

export async function createRecipe(input: RecipeDraft): Promise<Recipe> {
  const draft = normalizeRecipeDraft(input);
  const now = Date.now();
  const recipe: Recipe = {
    id: newId(),
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
    createdAt: now,
    updatedAt: now,
  };
  await db.recipes.add(recipe);
  return recipe;
}

/** Replaces the editable fields of a recipe. Keeps id, createdAt, favorite and seedKey. */
export async function updateRecipe(id: string, input: RecipeDraft): Promise<Recipe> {
  const draft = normalizeRecipeDraft(input);
  return db.transaction("rw", db.recipes, db.cookState, async () => {
    const existing = await db.recipes.get(id);
    if (!existing) throw new Error("Recipe not found");
    const next: Recipe = {
      ...existing,
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
      favorite: draft.favorite ?? existing.favorite,
      updatedAt: Date.now(),
    };
    await db.recipes.put(next);

    // Drop cooking progress for ingredients/steps that no longer exist.
    const state = await db.cookState.get(id);
    if (state) {
      const ingredientIds = new Set(next.ingredients.map((i) => i.id));
      const stepIds = new Set(next.steps.map((s) => s.id));
      await db.cookState.put({
        ...state,
        checkedIngredientIds: state.checkedIngredientIds.filter((x) => ingredientIds.has(x)),
        doneStepIds: state.doneStepIds.filter((x) => stepIds.has(x)),
      });
    }
    return next;
  });
}

/** A recipe exactly as stored, with its cooking progress, so an update can be undone. */
export interface RecipeSnapshot {
  recipe: Recipe;
  cookState: CookState | undefined;
}

export async function snapshotRecipe(id: string): Promise<RecipeSnapshot | null> {
  return db.transaction("r", db.recipes, db.cookState, async () => {
    const recipe = await db.recipes.get(id);
    return recipe ? { recipe, cookState: await db.cookState.get(id) } : null;
  });
}

/** Undo for updateRecipe: puts the snapshot back as it was (timestamps included). */
export async function restoreRecipeSnapshot(snapshot: RecipeSnapshot): Promise<void> {
  await db.transaction("rw", db.recipes, db.cookState, async () => {
    await db.recipes.put(snapshot.recipe);
    if (snapshot.cookState) await db.cookState.put(snapshot.cookState);
    else await db.cookState.delete(snapshot.recipe.id);
  });
}

/** Favouriting does not bump updatedAt, so it doesn't reshuffle "recently updated". */
export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await db.recipes.update(id, { favorite });
}

export async function duplicateRecipe(id: string): Promise<Recipe> {
  const source = await db.recipes.get(id);
  if (!source) throw new Error("Recipe not found");
  const now = Date.now();
  const copy: Recipe = {
    ...source,
    id: newId(),
    title: `${source.title} (copy)`,
    ingredients: source.ingredients.map((i) => ({ ...i, id: newId() })),
    steps: source.steps.map((s) => ({ ...s, id: newId() })),
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
  delete copy.seedKey;
  await db.recipes.add(copy);
  return copy;
}

export interface DeletedRecipe {
  recipe: Recipe;
  cookState: CookState | undefined;
  /** Log entries that pointed at the recipe; they keep their dish name and are unlinked. */
  unlinkedLogIds: string[];
}

/** Deletes a recipe. Its cook-log entries survive (dish name kept) but are unlinked. */
export async function deleteRecipe(id: string): Promise<DeletedRecipe | null> {
  return db.transaction("rw", db.recipes, db.logs, db.cookState, async () => {
    const recipe = await db.recipes.get(id);
    if (!recipe) return null;
    const cookState = await db.cookState.get(id);
    const logs = await db.logs.where("recipeId").equals(id).toArray();
    const now = Date.now();
    await db.logs.bulkPut(logs.map((l) => ({ ...l, recipeId: null, updatedAt: now })));
    await db.cookState.delete(id);
    await db.recipes.delete(id);
    return { recipe, cookState, unlinkedLogIds: logs.map((l) => l.id) };
  });
}

/** Undo for deleteRecipe: restores the recipe, its progress and its log links. */
export async function undoDeleteRecipe(snapshot: DeletedRecipe): Promise<void> {
  await db.transaction("rw", db.recipes, db.logs, db.cookState, async () => {
    await db.recipes.put(snapshot.recipe);
    if (snapshot.cookState) await db.cookState.put(snapshot.cookState);
    const logs = await db.logs.bulkGet(snapshot.unlinkedLogIds);
    const relink = logs.filter((l): l is NonNullable<typeof l> => !!l && l.recipeId === null);
    await db.logs.bulkPut(relink.map((l) => ({ ...l, recipeId: snapshot.recipe.id })));
  });
}

/** Re-adds any starter recipe that is no longer in the vault. Returns how many were added. */
export async function restoreStarterRecipes(): Promise<number> {
  return db.transaction("rw", db.recipes, async () => {
    const present = new Set(
      (await db.recipes.where("seedKey").anyOf(SEED_RECIPES.map((s) => s.seedKey)).toArray()).map((r) => r.seedKey),
    );
    const missing = new Set(SEED_RECIPES.map((s) => s.seedKey).filter((k) => !present.has(k)));
    if (missing.size === 0) return 0;
    const recipes = buildSeedRecipes(Date.now(), missing);
    await db.recipes.bulkAdd(recipes);
    return recipes.length;
  });
}
