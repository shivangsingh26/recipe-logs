import { describe, expect, it } from "vitest";
import { findExactRecipe, foldText, searchRecipes } from "./dishSearch";

const recipes = [
  { title: "Kacchi Chicken Dum Biryani (5L Cooker & Air Fryer Method)", categories: ["Biryani", "High-Protein"] },
  { title: "South Indian Black Pepper Chicken Roast (Dry Fry)", categories: ["High-Protein", "Air Fryer"] },
  { title: "Crème Brûlée", categories: ["Dessert"] },
  { title: "Chicken", categories: [] },
  { title: "Masala Chai", categories: ["Breakfast"] },
];

const titles = (list: Array<{ title: string }>) => list.map((r) => r.title);

describe("foldText", () => {
  it("drops case, accents and extra spaces", () => {
    expect(foldText("  Crème   Brûlée ")).toBe("creme brulee");
  });
});

describe("searchRecipes", () => {
  it("is case- and accent-insensitive", () => {
    expect(titles(searchRecipes(recipes, "BRULEE"))).toEqual(["Crème Brûlée"]);
    expect(titles(searchRecipes(recipes, "crème"))).toEqual(["Crème Brûlée"]);
  });

  it("ranks exact titles, then prefixes, then word matches", () => {
    expect(titles(searchRecipes(recipes, "chicken"))).toEqual([
      "Chicken",
      "Kacchi Chicken Dum Biryani (5L Cooker & Air Fryer Method)",
      "South Indian Black Pepper Chicken Roast (Dry Fry)",
    ]);
  });

  it("matches categories and requires every word", () => {
    expect(titles(searchRecipes(recipes, "breakfast"))).toEqual(["Masala Chai"]);
    expect(titles(searchRecipes(recipes, "pepper protein"))).toEqual([
      "South Indian Black Pepper Chicken Roast (Dry Fry)",
    ]);
    expect(searchRecipes(recipes, "pepper dessert")).toEqual([]);
  });

  it("respects the limit and ignores blank queries", () => {
    expect(searchRecipes(recipes, "i", 2)).toHaveLength(2);
    expect(searchRecipes(recipes, "   ")).toEqual([]);
  });
});

describe("findExactRecipe", () => {
  it("finds a title typed with different case/accents", () => {
    expect(findExactRecipe(recipes, " creme brulee ")?.title).toBe("Crème Brûlée");
    expect(findExactRecipe(recipes, "creme")).toBeUndefined();
    expect(findExactRecipe(recipes, "")).toBeUndefined();
  });
});
