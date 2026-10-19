// Live (reactive) queries. Each hook re-renders when the underlying tables change,
// including changes made in another tab. `undefined` always means "still loading".

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { DEFAULT_CATEGORIES, mergeCategories } from "@/lib/categories";
import type { CookLog, Recipe, RecipeStats } from "@/lib/types";
import { db } from "./db";
import { compareLogsNewestFirst } from "./logs";

/** All recipes, most recently updated first. */
export function useRecipes(): Recipe[] | undefined {
  return useLiveQuery(() => db.recipes.orderBy("updatedAt").reverse().toArray(), []);
}

/** One recipe: undefined while loading, null when it doesn't exist. */
export function useRecipe(id: string | null | undefined): Recipe | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.recipes.get(id)) ?? null) : null), [id]);
}

/** Logs with start ≤ date ≤ end (inclusive date keys), newest first. */
export function useLogsInRange(start: string, end: string): CookLog[] | undefined {
  return useLiveQuery(
    async () => (await db.logs.where("date").between(start, end, true, true).toArray()).sort(compareLogsNewestFirst),
    [start, end],
  );
}

/** Every log, newest first. Personal-scale data, so loading all of it is fine. */
export function useAllLogs(): CookLog[] | undefined {
  return useLiveQuery(async () => (await db.logs.toArray()).sort(compareLogsNewestFirst), []);
}

export function useLogsForRecipe(recipeId: string | null | undefined): CookLog[] | undefined {
  return useLiveQuery(
    async () => (recipeId ? (await db.logs.where("recipeId").equals(recipeId).toArray()).sort(compareLogsNewestFirst) : []),
    [recipeId],
  );
}

export function useLog(id: string | null | undefined): CookLog | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.logs.get(id)) ?? null) : null), [id]);
}

/** Cook count, last cooked date and latest plate photo for every recipe that has been logged. */
export function useRecipeStats(): Map<string, RecipeStats> | undefined {
  const logs = useAllLogs();
  return useMemo(() => {
    if (!logs) return undefined;
    const stats = new Map<string, RecipeStats>();
    // logs are newest first, so the first one seen per recipe is the latest.
    for (const log of logs) {
      if (!log.recipeId) continue;
      const s = stats.get(log.recipeId);
      if (!s) stats.set(log.recipeId, { count: 1, lastDate: log.date, coverPhotoId: log.photoId });
      else {
        s.count += 1;
        if (!s.coverPhotoId && log.photoId) s.coverPhotoId = log.photoId;
      }
    }
    return stats;
  }, [logs]);
}

/** Category vocabulary: the defaults first, then any custom ones in use (A–Z). */
export function useCategories(): string[] {
  const recipes = useRecipes();
  return useMemo(() => {
    const used = (recipes ?? []).flatMap((r) => r.categories).sort((a, b) => a.localeCompare(b));
    return mergeCategories(DEFAULT_CATEGORIES, used);
  }, [recipes]);
}

/** Only the categories actually used by at least one recipe, ordered by frequency. */
export function useUsedCategories(): string[] {
  const recipes = useRecipes();
  return useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const r of recipes ?? []) {
      for (const c of mergeCategories(r.categories)) {
        const key = c.toLowerCase();
        const entry = counts.get(key);
        if (entry) entry.n += 1;
        else counts.set(key, { name: c, n: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((e) => e.name);
  }, [recipes]);
}

/** Thumbnail/full-size object URL for a stored photo; revoked automatically. */
export function usePhotoUrl(photoId: string | null | undefined, variant: "thumb" | "full" = "thumb"): string | null {
  const photo = useLiveQuery(async () => (photoId ? ((await db.photos.get(photoId)) ?? null) : null), [photoId]);
  const url = useMemo(() => {
    if (!photo) return null;
    const bytes = variant === "full" ? photo.data : photo.thumb;
    return URL.createObjectURL(new Blob([bytes], { type: photo.mime }));
  }, [photo, variant]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
