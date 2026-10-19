import { describe, expect, it } from "vitest";
import type { Recipe, RecipeStats } from "@/lib/types";
import {
  categoryFilter,
  DEFAULT_VAULT_QUERY,
  filterCategory,
  foldText,
  isFiltered,
  matchesFilter,
  matchesSearch,
  parseVaultQuery,
  queryRecipes,
  searchTerms,
  sortRecipes,
} from "./query";

function recipe(id: string, partial: Partial<Recipe> = {}): Recipe {
  return {
    id,
    title: id,
    description: "",
    categories: [],
    prepMinutes: null,
    cookMinutes: null,
    servings: null,
    macros: { calories: null, protein: null, carbs: null, fat: null },
    ingredients: [],
    steps: [],
    notes: "",
    source: "",
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const ids = (recipes: Recipe[]) => recipes.map((r) => r.id);

describe("text folding and terms", () => {
  it("folds case and accents", () => {
    expect(foldText("Crème BRÛLÉE Jalapeño")).toBe("creme brulee jalapeno");
  });

  it("splits on any whitespace and drops blanks", () => {
    expect(searchTerms("  Chicken \t PEPPER\n")).toEqual(["chicken", "pepper"]);
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("matchesSearch", () => {
  const biryani = recipe("b", {
    title: "Kacchi Chicken Dum Biryani",
    description: "One-pot dum",
    categories: ["High-Protein"],
    ingredients: [{ id: "i1", text: "2 tbsp ghee" }],
    steps: [{ id: "s1", text: "Air fry the onions" }],
    notes: "Use aged basmati",
  });

  it("matches every field it should search", () => {
    for (const q of ["kacchi", "one-pot", "protein", "ghee", "basmati"]) {
      expect(matchesSearch(biryani, searchTerms(q))).toBe(true);
    }
  });

  it("requires every term, in any field and any order", () => {
    expect(matchesSearch(biryani, searchTerms("ghee chicken"))).toBe(true);
    expect(matchesSearch(biryani, searchTerms("ghee paneer"))).toBe(false);
  });

  it("is case- and accent-insensitive in both directions", () => {
    const creme = recipe("c", { title: "Crème caramel" });
    expect(matchesSearch(creme, searchTerms("CREME"))).toBe(true);
    expect(matchesSearch(recipe("d", { title: "Creme" }), searchTerms("crème"))).toBe(true);
  });

  it("does not search step text", () => {
    expect(matchesSearch(biryani, searchTerms("onions"))).toBe(false);
  });

  it("matches everything for an empty search", () => {
    expect(matchesSearch(biryani, [])).toBe(true);
  });
});

describe("filters", () => {
  const fav = recipe("fav", { favorite: true, categories: ["High-Protein"] });
  const plain = recipe("plain", { categories: ["Curry"] });

  it("supports all, favorites and categories (matched by category key)", () => {
    expect(matchesFilter(plain, "all")).toBe(true);
    expect(matchesFilter(fav, "favorites")).toBe(true);
    expect(matchesFilter(plain, "favorites")).toBe(false);
    expect(matchesFilter(fav, categoryFilter("high protein"))).toBe(true);
    expect(matchesFilter(plain, categoryFilter("High-Protein"))).toBe(false);
  });

  it("round-trips category filters", () => {
    expect(filterCategory(categoryFilter("Air Fryer"))).toBe("Air Fryer");
    expect(filterCategory("favorites")).toBeNull();
  });

  it("knows when the list is narrowed", () => {
    expect(isFiltered(DEFAULT_VAULT_QUERY)).toBe(false);
    expect(isFiltered({ ...DEFAULT_VAULT_QUERY, sort: "az" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_VAULT_QUERY, search: " x " })).toBe(true);
    expect(isFiltered({ ...DEFAULT_VAULT_QUERY, filter: "favorites" })).toBe(true);
  });
});

describe("sortRecipes", () => {
  const stats = new Map<string, RecipeStats>([
    ["a", { count: 3, lastDate: "2026-10-01", coverPhotoId: null }],
    ["b", { count: 5, lastDate: "2026-09-01", coverPhotoId: null }],
    ["c", { count: 3, lastDate: "2026-10-10", coverPhotoId: null }],
  ]);

  it("defaults to most recently updated", () => {
    const list = [recipe("a", { updatedAt: 1 }), recipe("b", { updatedAt: 3 }), recipe("c", { updatedAt: 2 })];
    expect(ids(sortRecipes(list, "updated"))).toEqual(["b", "c", "a"]);
  });

  it("sorts A–Z ignoring case and numbering naturally", () => {
    const list = [recipe("1", { title: "egg 10" }), recipe("2", { title: "Egg 9" }), recipe("3", { title: "apple" })];
    expect(ids(sortRecipes(list, "az"))).toEqual(["3", "2", "1"]);
  });

  it("sorts by cook count, breaking ties by the latest cook; never cooked last", () => {
    const list = [recipe("d"), recipe("a"), recipe("b"), recipe("c")];
    expect(ids(sortRecipes(list, "most-cooked", stats))).toEqual(["b", "c", "a", "d"]);
  });

  it("sorts by last cooked date with never-cooked recipes last", () => {
    const list = [recipe("d", { updatedAt: 9 }), recipe("a"), recipe("b"), recipe("c")];
    expect(ids(sortRecipes(list, "recent-cooked", stats))).toEqual(["c", "a", "b", "d"]);
  });

  it("puts the quickest first and unknown (or zero) times last", () => {
    const list = [
      recipe("slow", { prepMinutes: 30, cookMinutes: 60 }),
      recipe("unknown"),
      recipe("zero", { prepMinutes: 0, cookMinutes: 0 }),
      recipe("fast", { cookMinutes: 20 }),
    ];
    expect(ids(sortRecipes(list, "quickest"))).toEqual(["fast", "slow", "unknown", "zero"]);
  });

  it("puts the most protein first and unknown protein last", () => {
    const macros = (protein: number | null) => ({ calories: null, protein, carbs: null, fat: null });
    const list = [recipe("low", { macros: macros(10) }), recipe("none", { macros: macros(null) }), recipe("high", { macros: macros(46) })];
    expect(ids(sortRecipes(list, "protein"))).toEqual(["high", "low", "none"]);
  });

  it("does not mutate its input", () => {
    const list = [recipe("a", { updatedAt: 1 }), recipe("b", { updatedAt: 2 })];
    sortRecipes(list, "updated");
    expect(ids(list)).toEqual(["a", "b"]);
  });
});

describe("queryRecipes", () => {
  it("filters, searches and sorts together", () => {
    const list = [
      recipe("pepper", { title: "Pepper chicken", favorite: true, updatedAt: 1 }),
      recipe("biryani", { title: "Chicken biryani", favorite: true, updatedAt: 2 }),
      recipe("dal", { title: "Dal", favorite: true, updatedAt: 3 }),
      recipe("other", { title: "Chicken soup", updatedAt: 4 }),
    ];
    const result = queryRecipes(list, { search: "chicken", filter: "favorites", sort: "az" });
    expect(ids(result)).toEqual(["biryani", "pepper"]);
  });
});

describe("parseVaultQuery", () => {
  it("keeps a valid query", () => {
    const query = { search: "dal", filter: categoryFilter("Curry"), sort: "protein" } as const;
    expect(parseVaultQuery(query)).toEqual(query);
  });

  it("falls back to defaults for anything invalid", () => {
    expect(parseVaultQuery(null)).toEqual(DEFAULT_VAULT_QUERY);
    expect(parseVaultQuery("nope")).toEqual(DEFAULT_VAULT_QUERY);
    expect(parseVaultQuery({ search: 4, filter: "category:", sort: "spicy" })).toEqual(DEFAULT_VAULT_QUERY);
  });
});
