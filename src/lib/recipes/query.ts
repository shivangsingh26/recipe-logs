// Vault search, filter and sort as pure functions, so the list screen stays a thin view.

import { hasCategory } from "@/lib/categories";
import { totalMinutes } from "@/lib/format";
import type { Recipe, RecipeStats } from "@/lib/types";

export type RecipeSort = "updated" | "az" | "most-cooked" | "recent-cooked" | "quickest" | "protein";

export interface SortOption {
  value: RecipeSort;
  label: string;
  /** Compact label for the sort chip. */
  short: string;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  { value: "updated", label: "Recently updated", short: "Recent" },
  { value: "az", label: "A–Z", short: "A–Z" },
  { value: "most-cooked", label: "Most cooked", short: "Most cooked" },
  { value: "recent-cooked", label: "Recently cooked", short: "Last cooked" },
  { value: "quickest", label: "Quickest", short: "Quickest" },
  { value: "protein", label: "Most protein", short: "Protein" },
];

/** Single-select vault filter: everything, favourites, or one category. */
export type VaultFilter = "all" | "favorites" | `category:${string}`;

export interface VaultQuery {
  search: string;
  filter: VaultFilter;
  sort: RecipeSort;
}

export const DEFAULT_VAULT_QUERY: VaultQuery = { search: "", filter: "all", sort: "updated" };

const CATEGORY_PREFIX = "category:";

export function categoryFilter(category: string): VaultFilter {
  return `${CATEGORY_PREFIX}${category}`;
}

/** The category a filter selects, or null for "all" / "favorites". */
export function filterCategory(filter: VaultFilter): string | null {
  return filter.startsWith(CATEGORY_PREFIX) ? filter.slice(CATEGORY_PREFIX.length) : null;
}

/** True when a search or filter narrows the list (sorting alone does not). */
export function isFiltered(query: VaultQuery): boolean {
  return query.search.trim() !== "" || query.filter !== "all";
}

/** Lowercased and accent-free: "Crème Brûlée" → "creme brulee". */
export function foldText(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function searchTerms(search: string): string[] {
  return foldText(search).split(/\s+/).filter(Boolean);
}

// Typing re-filters the same recipe objects on every keystroke, so cache their folded text.
const haystacks = new WeakMap<Recipe, string>();

function haystackOf(recipe: Recipe): string {
  let text = haystacks.get(recipe);
  if (text === undefined) {
    text = foldText(
      [recipe.title, recipe.description, ...recipe.categories, ...recipe.ingredients.map((i) => i.text), recipe.notes].join(
        "\n",
      ),
    );
    haystacks.set(recipe, text);
  }
  return text;
}

/** Every term must appear somewhere in the title, description, categories, ingredients or notes. */
export function matchesSearch(recipe: Recipe, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = haystackOf(recipe);
  return terms.every((term) => haystack.includes(term));
}

export function matchesFilter(recipe: Recipe, filter: VaultFilter): boolean {
  if (filter === "all") return true;
  if (filter === "favorites") return recipe.favorite;
  return hasCategory(recipe.categories, filterCategory(filter) ?? "");
}

type StatsMap = ReadonlyMap<string, RecipeStats>;
type Compare = (a: Recipe, b: Recipe) => number;

const byTitle: Compare = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
const byUpdated: Compare = (a, b) => b.updatedAt - a.updatedAt;

/** Known values first (ascending or descending), unknowns last. */
function knownFirst(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  return (a - b) * direction;
}

/** Newest date key first, never-cooked (null) last. Date keys sort lexicographically. */
function newestFirst(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a == null || b == null) return a == null ? 1 : -1;
  return a < b ? 1 : -1;
}

/** Prep + cook in minutes; a zero total counts as unknown. */
function knownTotal(recipe: Recipe): number | null {
  const total = totalMinutes(recipe.prepMinutes, recipe.cookMinutes);
  return total && total > 0 ? total : null;
}

function comparator(sort: RecipeSort, stats: StatsMap | undefined): Compare {
  const count = (r: Recipe) => stats?.get(r.id)?.count ?? 0;
  const last = (r: Recipe) => stats?.get(r.id)?.lastDate ?? null;
  switch (sort) {
    case "az":
      return (a, b) => byTitle(a, b) || byUpdated(a, b);
    case "most-cooked":
      return (a, b) => count(b) - count(a) || newestFirst(last(a), last(b)) || byTitle(a, b);
    case "recent-cooked":
      return (a, b) => newestFirst(last(a), last(b)) || count(b) - count(a) || byUpdated(a, b);
    case "quickest":
      return (a, b) => knownFirst(knownTotal(a), knownTotal(b), 1) || byTitle(a, b);
    case "protein":
      return (a, b) => knownFirst(a.macros.protein, b.macros.protein, -1) || byTitle(a, b);
    default:
      return (a, b) => byUpdated(a, b) || byTitle(a, b);
  }
}

export function sortRecipes(recipes: readonly Recipe[], sort: RecipeSort, stats?: StatsMap): Recipe[] {
  return [...recipes].sort(comparator(sort, stats));
}

/** Filter + search + sort in one pass, as the vault list shows it. */
export function queryRecipes(recipes: readonly Recipe[], query: VaultQuery, stats?: StatsMap): Recipe[] {
  const terms = searchTerms(query.search);
  const matches = recipes.filter((r) => matchesFilter(r, query.filter) && matchesSearch(r, terms));
  return sortRecipes(matches, query.sort, stats);
}

function isRecipeSort(value: unknown): value is RecipeSort {
  return SORT_OPTIONS.some((o) => o.value === value);
}

function isVaultFilter(value: unknown): value is VaultFilter {
  if (value === "all" || value === "favorites") return true;
  return typeof value === "string" && value.startsWith(CATEGORY_PREFIX) && value.length > CATEGORY_PREFIX.length;
}

/** Sanitises a remembered query (e.g. from sessionStorage); anything invalid falls back to the default. */
export function parseVaultQuery(raw: unknown): VaultQuery {
  const q = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    search: typeof q.search === "string" ? q.search.slice(0, 200) : DEFAULT_VAULT_QUERY.search,
    filter: isVaultFilter(q.filter) ? q.filter : DEFAULT_VAULT_QUERY.filter,
    sort: isRecipeSort(q.sort) ? q.sort : DEFAULT_VAULT_QUERY.sort,
  };
}
