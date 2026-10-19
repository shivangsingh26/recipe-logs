import { describe, expect, it } from "vitest";
import { normalizeRecipeDraft } from "@/lib/db/normalize";
import { parseRecipeText } from "@/lib/parser/parseRecipe";
import { SEED_RECIPES } from "@/lib/seeds";
import { EMPTY_MACROS, type RecipeDraft } from "@/lib/types";
import { splitBold } from "./inline";
import { recipeToMarkdown } from "./recipeMarkdown";

function draft(partial: Partial<RecipeDraft>): RecipeDraft {
  return normalizeRecipeDraft({
    title: "Test recipe",
    description: "",
    categories: ["Dinner"],
    prepMinutes: null,
    cookMinutes: null,
    servings: null,
    macros: EMPTY_MACROS,
    ingredients: [],
    steps: [],
    notes: "",
    source: "",
    ...partial,
  });
}

function comparable(r: RecipeDraft) {
  const d = normalizeRecipeDraft(r);
  return {
    title: d.title,
    description: d.description,
    categories: d.categories,
    prepMinutes: d.prepMinutes,
    cookMinutes: d.cookMinutes,
    servings: d.servings,
    macros: d.macros,
    ingredients: d.ingredients.map((i) => ({ text: i.text, group: i.group })),
    steps: d.steps.map((s) => ({ text: s.text, group: s.group })),
    notes: d.notes,
    source: d.source,
  };
}

function expectRoundTrip(recipe: RecipeDraft) {
  const markdown = recipeToMarkdown(recipe);
  const parsed = parseRecipeText(markdown);
  expect(comparable(parsed.draft), markdown).toEqual(comparable(recipe));
  return { markdown, parsed };
}

const EDGE_RECIPES: Record<string, RecipeDraft> = {
  "no groups, no macros": draft({
    title: "Simple Dal",
    categories: ["Lunch", "Vegetarian"],
    ingredients: [{ text: "1 cup toor dal" }, { text: "3 cups water" }, { text: "Salt to taste" }],
    steps: [{ text: "Pressure cook the dal for 4 whistles." }, { text: "Temper with ghee and cumin." }],
  }),
  "partial macros": draft({
    title: "Protein Oats",
    macros: { calories: 420, protein: 32.5, carbs: null, fat: null },
    servings: 1,
    prepMinutes: 5,
    ingredients: [{ text: "60 g oats" }],
    steps: [{ text: "Cook the oats." }],
  }),
  "multi-line steps": draft({
    title: "Layered Steps",
    ingredients: [{ text: "Rice" }],
    steps: [
      { text: "**Prep:**\n- Rinse the rice\n- Soak for 30 min" },
      { text: "Boil the water.\nAdd the rice." },
      { text: "**Rest**\nKeep covered for 10 min." },
      { text: "First paragraph.\n\nSecond paragraph." },
    ],
  }),
  "markdown-looking text": draft({
    title: "# Hash | Pipe Recipe",
    description: "1. Not a step\n# Not a heading\n| not | a table |\nServes 4 hungry people\nIngredients\n- **bold** and _italic_ words",
    categories: ["Lunch/Dinner", "Spicy, Hot"],
    ingredients: [
      { text: "Garnish:" },
      { text: "1. 5 cups flour" },
      { text: "[ ] unchecked box" },
      { text: "Salt | pepper" },
      { text: "Serves 4" },
      { text: "770 kcal, 46 g protein" },
      { text: "2 tbsp oil*" },
    ],
    steps: [
      { text: "1. Already numbered" },
      { text: "Step 3: keep this prefix" },
      { text: "# hash at the start" },
      { text: "- dash at the start" },
      { text: "Enjoy!" },
      { text: "Prep time: 10 min" },
      { text: "Use a `code` and *star* and a back\\slash" },
    ],
    notes: "* star bullet\nStorage\nIngredients: not a section\nhttps://example.com/not-the-source\n---\n**Tip:** bold label",
    source: "https://example.com/recipes/a_b?x=1|2",
  }),
  "groups with ungrouped items after": draft({
    title: "Mixed Groups",
    ingredients: [
      { text: "500 g chicken", group: "Marinade" },
      { text: "1 tsp salt", group: "Marinade" },
      { text: "Coriander, to serve" },
      { text: "2 tbsp ghee", group: "Preparation" },
    ],
    steps: [
      { text: "Mix.", group: "1. First" },
      { text: "Fry.", group: "To serve" },
      { text: "Serve." },
    ],
  }),
  "no ingredients": draft({
    title: "Just Steps",
    description: "2 cups of joy\nHeat the pan until it smokes.",
    steps: [{ text: "Heat the pan." }],
  }),
  "title only": draft({ title: "Bare Title", categories: [] }),
};

describe("recipeToMarkdown", () => {
  it("writes the canonical shape", () => {
    const md = recipeToMarkdown(SEED_RECIPES[0]);
    expect(md.startsWith("# Kacchi Chicken Dum Biryani (5L Cooker & Air Fryer Method)\n\nRaw-marinated")).toBe(true);
    expect(md).toContain("- **Prep time:** 30 min\n- **Cook time:** 60 min\n- **Servings:** 4\n- **Categories:** Biryani, High-Protein, Dinner");
    expect(md).toContain("## Macros (per serving)\n| Calories | Protein | Carbs | Fat |\n| --- | --- | --- | --- |\n| 770 kcal | 46 g | 94 g | 23 g |");
    expect(md).toContain("## Ingredients\n### Birista (air fryer)\n- 3 large onions (≈450 g), thinly sliced");
    expect(md).toContain("## Instructions\n### Prep\n1. **Make the birista:** Toss");
    expect(md).toContain("### Dum\n5. **Layer the cooker:**");
    expect(md).toContain("## Notes & Tips\n- Bone-in thighs");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("omits empty parts", () => {
    const md = recipeToMarkdown(draft({ title: "Bare", categories: [] }));
    expect(md).toBe("# Bare\n");
  });

  it("writes the source last", () => {
    const md = recipeToMarkdown(draft({ title: "With source", source: "https://example.com/x", notes: "- tip" }));
    expect(md.trimEnd().endsWith("**Source:** https://example.com/x")).toBe(true);
  });

  it.each(SEED_RECIPES.map((seed) => [seed.title, seed] as const))("round-trips the seed %s", (_title, seed) => {
    const { parsed } = expectRoundTrip(seed);
    expect(parsed.warnings).toEqual([]);
  });

  it.each(Object.entries(EDGE_RECIPES))("round-trips %s", (_name, recipe) => {
    expectRoundTrip(recipe);
  });

  it("keeps ordinary text unescaped", () => {
    const md = recipeToMarkdown(SEED_RECIPES[1]);
    expect(md).not.toContain("\\");
  });
});

describe("splitBold", () => {
  it("splits bold runs", () => {
    expect(splitBold("**Sear:** Add the chicken")).toEqual([
      { text: "Sear:", bold: true },
      { text: " Add the chicken", bold: false },
    ]);
    expect(splitBold("plain")).toEqual([{ text: "plain", bold: false }]);
    expect(splitBold("a **b** c **d**")).toEqual([
      { text: "a ", bold: false },
      { text: "b", bold: true },
      { text: " c ", bold: false },
      { text: "d", bold: true },
    ]);
  });
});
