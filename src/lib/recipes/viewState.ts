// Session-scoped view state for the recipe screens: the vault's search/filter/sort and scroll
// position, and the open tab per recipe. It lives in sessionStorage so coming back from a recipe
// (or reloading) restores the view, with an in-memory copy for when storage is blocked.

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_VAULT_QUERY, parseVaultQuery, type VaultQuery } from "./query";

/** sessionStorage keys (candidates for STORAGE_KEYS in lib/storageKeys.ts). */
export const RECIPE_VIEW_KEYS = {
  vaultQuery: "culinarylog:vault-query:v1",
  vaultScroll: "culinarylog:vault-scroll:v1",
  recipeTabs: "culinarylog:recipe-tabs:v1",
} as const;

export type RecipeTab = "ingredients" | "steps" | "notes" | "history";

export const RECIPE_TABS: readonly RecipeTab[] = ["ingredients", "steps", "notes", "history"];

const MAX_REMEMBERED_TABS = 50;

function readJson(key: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked or full: the in-memory copy still serves this page session.
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

let vaultQuery: VaultQuery | null = null;

function getVaultQuery(): VaultQuery {
  vaultQuery ??= parseVaultQuery(readJson(RECIPE_VIEW_KEYS.vaultQuery));
  return vaultQuery;
}

function getDefaultVaultQuery(): VaultQuery {
  return DEFAULT_VAULT_QUERY;
}

/** The vault's search/filter/sort (defaults during prerender and hydration) and a patching setter. */
export function useVaultQuery(): [VaultQuery, (patch: Partial<VaultQuery>) => void] {
  const query = useSyncExternalStore(subscribe, getVaultQuery, getDefaultVaultQuery);
  const update = useCallback((patch: Partial<VaultQuery>) => {
    vaultQuery = { ...getVaultQuery(), ...patch };
    writeJson(RECIPE_VIEW_KEYS.vaultQuery, vaultQuery);
    emit();
  }, []);
  return [query, update];
}

export function loadVaultScroll(): number {
  const y = readJson(RECIPE_VIEW_KEYS.vaultScroll);
  return typeof y === "number" && Number.isFinite(y) && y > 0 ? y : 0;
}

export function saveVaultScroll(y: number): void {
  writeJson(RECIPE_VIEW_KEYS.vaultScroll, Math.max(0, Math.round(y)));
}

type TabMap = Readonly<Record<string, RecipeTab>>;

const NO_TABS: TabMap = {};
let recipeTabs: TabMap | null = null;

function isRecipeTab(value: unknown): value is RecipeTab {
  return RECIPE_TABS.some((tab) => tab === value);
}

function getRecipeTabs(): TabMap {
  if (recipeTabs) return recipeTabs;
  const raw = readJson(RECIPE_VIEW_KEYS.recipeTabs);
  const map: Record<string, RecipeTab> = {};
  if (raw && typeof raw === "object") {
    for (const [id, tab] of Object.entries(raw)) if (isRecipeTab(tab)) map[id] = tab;
  }
  recipeTabs = map;
  return recipeTabs;
}

function getNoTabs(): TabMap {
  return NO_TABS;
}

/** The selected section on a recipe page, remembered per recipe for this session. */
export function useRecipeTab(recipeId: string): [RecipeTab, (tab: RecipeTab) => void] {
  const tabs = useSyncExternalStore(subscribe, getRecipeTabs, getNoTabs);
  const setTab = useCallback(
    (tab: RecipeTab) => {
      // Most recently used last, so the oldest entries are the ones trimmed.
      const entries = Object.entries(getRecipeTabs()).filter(([id]) => id !== recipeId);
      entries.push([recipeId, tab]);
      recipeTabs = Object.fromEntries(entries.slice(-MAX_REMEMBERED_TABS));
      writeJson(RECIPE_VIEW_KEYS.recipeTabs, recipeTabs);
      emit();
    },
    [recipeId],
  );
  return [tabs[recipeId] ?? "ingredients", setTab];
}
