// IndexedDB schema (via Dexie). Local-first: this database IS the source of truth;
// backups are exported from it and restored into it.
//
// Index notes: IndexedDB cannot index booleans or null, so `favorite` is not indexed
// and logs with `recipeId: null` simply don't appear in the recipeId index.

import Dexie, { type EntityTable } from "dexie";
import { buildSeedRecipes } from "@/lib/seeds";
import type { CookLog, CookState, Photo, Recipe, SettingRow } from "@/lib/types";

export const DB_NAME = "culinarylog";

export class CulinaryDB extends Dexie {
  recipes!: EntityTable<Recipe, "id">;
  logs!: EntityTable<CookLog, "id">;
  photos!: EntityTable<Photo, "id">;
  cookState!: EntityTable<CookState, "recipeId">;
  settings!: EntityTable<SettingRow, "key">;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      recipes: "id, title, *categories, createdAt, updatedAt, seedKey",
      logs: "id, date, recipeId, mealType, createdAt",
      photos: "id, logId",
      cookState: "recipeId",
      settings: "key",
    });

    // Runs exactly once, when the database is first created on this device.
    this.on("populate", (tx) => {
      const now = Date.now();
      tx.table("recipes").bulkAdd(buildSeedRecipes(now));
      tx.table("settings").put({ key: "seededAt", value: now } satisfies SettingRow);
    });
  }
}

// Constructing Dexie does not touch IndexedDB (it opens lazily on first query),
// so this module is safe to import while Next.js prerenders pages at build time.
export const db = new CulinaryDB();
