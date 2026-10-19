import { describe, expect, it } from "vitest";
import { EXAMPLE_RECIPE_TEXT } from "./example";
import { PARSE_WARNINGS, parseRecipeText } from "./parseRecipe";
import { buildPrefillText, hasPrefill } from "./prefill";

const parse = (text: string) => parseRecipeText(text);
const texts = (items: ReadonlyArray<{ text: string }>) => items.map((i) => i.text);
const macrosOf = (text: string) => parse(text).draft.macros;

const CHATGPT_BIRYANI = `Sure! Here's a high-protein biryani made in a 5-litre pressure cooker with air-fried onions:

# 🍛 Kacchi Chicken Dum Biryani (5L Cooker)

A dum biryani where raw marinated chicken and 70% cooked rice steam together.

- **Prep Time:** 30 mins (+ 2 hrs marinating)
- **Cook Time:** 1 hr
- **Servings:** 4
- **Cuisine:** Indian · Mughlai

---

## 🧾 Ingredients

### For the birista
- 3 large onions, thinly sliced
- 1 tbsp oil

### For the marinade
- 750 g chicken, bone-in
- 1 cup thick curd
- 1½ tsp Kashmiri chilli powder
- ½ tsp turmeric

**For the rice:**
- 2 cups aged basmati rice
- 2.5 L water

## 🔥 Instructions

### Prep
1. **Make the birista:** Air fry the onions at 160°C for 14 min.
2. **Marinate:** Mix the chicken with the marinade and refrigerate for 2 hours.

### Dum
3. **Parboil:** Boil the rice for 5–6 min until 70% done.
4. **Layer and seal:** Layer chicken and rice in the 5 L cooker. Cook on high for 7 min, then dum on low for 25 min.

## 📊 Macros (per serving)

| Calories | Protein | Carbs | Fat |
|---|---|---|---|
| ~770 kcal | 46 g | 94 g | 23 g |

## 💡 Tips
* Use aged basmati — it stays separate.
• Never add the whistle.

Enjoy your biryani! 🍽️
Let me know if you'd like a vegetarian version.`;

describe("parseRecipeText — full documents", () => {
  it("parses a ChatGPT-style biryani with emoji headings, groups, a macros table and tips", () => {
    const { draft, warnings } = parse(CHATGPT_BIRYANI);
    expect(warnings).toEqual([]);
    expect(draft.title).toBe("Kacchi Chicken Dum Biryani (5L Cooker)");
    expect(draft.description).toBe("A dum biryani where raw marinated chicken and 70% cooked rice steam together.");
    expect(draft.prepMinutes).toBe(30);
    expect(draft.cookMinutes).toBe(60);
    expect(draft.servings).toBe(4);
    expect(draft.categories).toEqual(["Indian", "Mughlai"]);
    expect(draft.macros).toEqual({ calories: 770, protein: 46, carbs: 94, fat: 23 });
    expect(draft.ingredients).toEqual([
      { text: "3 large onions, thinly sliced", group: "For the birista" },
      { text: "1 tbsp oil", group: "For the birista" },
      { text: "750 g chicken, bone-in", group: "For the marinade" },
      { text: "1 cup thick curd", group: "For the marinade" },
      { text: "1½ tsp Kashmiri chilli powder", group: "For the marinade" },
      { text: "½ tsp turmeric", group: "For the marinade" },
      { text: "2 cups aged basmati rice", group: "For the rice" },
      { text: "2.5 L water", group: "For the rice" },
    ]);
    expect(draft.steps).toEqual([
      { text: "**Make the birista:** Air fry the onions at 160°C for 14 min.", group: "Prep" },
      { text: "**Marinate:** Mix the chicken with the marinade and refrigerate for 2 hours.", group: "Prep" },
      { text: "**Parboil:** Boil the rice for 5–6 min until 70% done.", group: "Dum" },
      {
        text: "**Layer and seal:** Layer chicken and rice in the 5 L cooker. Cook on high for 7 min, then dum on low for 25 min.",
        group: "Dum",
      },
    ]);
    expect(draft.notes).toBe("- Use aged basmati — it stays separate.\n- Never add the whistle.");
  });

  it("parses website-style plain text", () => {
    const { draft, warnings } = parse(`South Indian Pepper Chicken
A dry, peppery roast from Kerala.
Prep Time 15 mins
Cook Time 35 mins
Total Time 50 mins
Servings 3

Ingredients
500 g boneless chicken thighs
1½ tbsp black peppercorns
2 sprigs curry leaves
Salt to taste

Directions
Toast the peppercorns for 2 minutes, then crush them coarsely.
Heat the coconut oil and fry the shallots for 8 minutes until golden.
Add the chicken and cook covered for 12 minutes.

Notes
Thighs stay juicier than breast.`);
    expect(warnings).toEqual([]);
    expect(draft.title).toBe("South Indian Pepper Chicken");
    expect(draft.description).toBe("A dry, peppery roast from Kerala.");
    expect([draft.prepMinutes, draft.cookMinutes, draft.servings]).toEqual([15, 35, 3]);
    expect(texts(draft.ingredients)).toEqual([
      "500 g boneless chicken thighs",
      "1½ tbsp black peppercorns",
      "2 sprigs curry leaves",
      "Salt to taste",
    ]);
    expect(draft.steps).toHaveLength(3);
    expect(draft.steps[1].text).toBe("Heat the coconut oil and fry the shallots for 8 minutes until golden.");
    expect(draft.notes).toBe("Thighs stay juicier than breast.");
  });

  it("parses the built-in example without warnings", () => {
    const { draft, warnings } = parse(EXAMPLE_RECIPE_TEXT);
    expect(warnings).toEqual([]);
    expect(draft.title).toBe("Air Fryer Tandoori Chicken");
    expect(draft.ingredients).toHaveLength(12);
    expect(draft.steps).toHaveLength(6);
    expect(draft.macros).toEqual({ calories: 410, protein: 48, carbs: 9, fat: 20 });
    expect(draft.categories).toEqual(["High-Protein", "Air Fryer", "Dinner"]);
  });

  it("drops a chat preamble and sign-off", () => {
    const { draft } = parse(CHATGPT_BIRYANI);
    expect(draft.description).not.toContain("Sure");
    expect(draft.notes).not.toContain("Enjoy");
    expect(draft.notes).not.toContain("Let me know");
  });
});

describe("parseRecipeText — metadata", () => {
  it("reads several facts from one line", () => {
    const { draft } = parse("# Dal\nPrep: 20 min | Cook: 45 min | Serves 4\n## Ingredients\n- dal\n## Method\n1. Cook.");
    expect([draft.prepMinutes, draft.cookMinutes, draft.servings]).toEqual([20, 45, 4]);
    expect(draft.description).toBe("");
  });

  it("reads bold-label bullets and keeps unknown segments as description", () => {
    const { draft } = parse(
      "# Dal\n- **Prep Time:** 20 mins\n- **Cooking time:** 1 hr 15 min\n- **Yield:** 2 plates\nPrep: 10 min · Marinate: 2 hours\n## Ingredients\n- dal",
    );
    expect([draft.prepMinutes, draft.cookMinutes, draft.servings]).toEqual([20, 75, 2]);
    expect(draft.description).toBe("Marinate: 2 hours");
  });

  it.each([
    ["Serves 4–6", 4],
    ["4 servings", 4],
    ["Yield: 2 plates", 2],
    ["Makes 12", 12],
    ["Servings: four", 4],
  ])("servings from %s", (line, servings) => {
    expect(parse(`# X\n${line}\n## Ingredients\n- a`).draft.servings).toBe(servings);
  });

  it.each([
    ["1h15m", 75],
    ["1.5 hours", 90],
    ["90 minutes", 90],
    ["an hour", 60],
    ["½ hour", 30],
    ["30-40 min", 30],
  ])("cook time from %s", (value, minutes) => {
    expect(parse(`# X\nCook time: ${value}\n## Ingredients\n- a`).draft.cookMinutes).toBe(minutes);
  });

  it("derives the missing time from the total", () => {
    expect(parse("# X\nPrep: 15 min\nTotal time: 50 min\n## Ingredients\n- a").draft.cookMinutes).toBe(35);
    expect(parse("# X\nCook: 40 min\nReady in: 1 hour\n## Ingredients\n- a").draft.prepMinutes).toBe(20);
  });

  it("stores a total-only time as the cook time with a warning", () => {
    const { draft, warnings } = parse("# X\nTotal time: 45 minutes\n## Ingredients\n- a\n## Steps\n1. Go.");
    expect(draft.cookMinutes).toBe(45);
    expect(draft.prepMinutes).toBeNull();
    expect(warnings).toEqual([PARSE_WARNINGS.totalOnly]);
  });

  it("splits and canonicalises explicit categories, and suggests some when none are given", () => {
    expect(parse("# X\nTags: dinner · high protein | Curry; quick meal\n## Ingredients\n- a").draft.categories).toEqual([
      "Dinner",
      "High-Protein",
      "Curry",
      "Quick Meal",
    ]);
    const suggested = parse("# Chicken Biryani\nPrep: 10 min\nCook: 15 min\n## Ingredients\n- rice\n## Steps\n1. Air fry the onions.");
    expect(suggested.draft.categories).toEqual(["Biryani", "Air Fryer", "Quick Meal"]);
  });

  it("captures the link target of a source line", () => {
    expect(parse("# X\nSource: [Serious Eats](https://www.seriouseats.com/biryani)\n## Ingredients\n- a").draft.source).toBe(
      "https://www.seriouseats.com/biryani",
    );
    expect(parse("# X\n## Ingredients\n- a\n\nAdapted from Grandma's notebook").draft.source).toBe("Grandma's notebook");
    expect(parse("# X\nhttps://example.com/dal\n## Ingredients\n- a").draft.source).toBe("https://example.com/dal");
  });
});

describe("parseRecipeText — macros", () => {
  it.each([
    ["Calories: ~770 kcal\nProtein — 46g\nCarbs: 94 g\nFat: 23 g", { calories: 770, protein: 46, carbs: 94, fat: 23 }],
    ["P: 46 g\nC: 94 g\nF: 23 g\nCalories 770", { calories: 770, protein: 46, carbs: 94, fat: 23 }],
    ["46g protein, 94g carbs, 23g fat, 770 kcal", { calories: 770, protein: 46, carbs: 94, fat: 23 }],
    ["770 kcal | 46g P | 94g C | 23g F", { calories: 770, protein: 46, carbs: 94, fat: 23 }],
    ["Per serving: 770 kcal, 46 g protein, 94 g carbs, 23 g fat", { calories: 770, protein: 46, carbs: 94, fat: 23 }],
    ["Energy: 3220 kJ\nTotal carbohydrates: 94 g\nTotal fat: 23 g\nSaturated fat: 5 g", { calories: 770, protein: null, carbs: 94, fat: 23 }],
    ["Calories: approx. 700–800\nProtein: about 40-50 g", { calories: 750, protein: 45, carbs: null, fat: null }],
  ])("reads %j", (block, expected) => {
    expect(macrosOf(`# X\n## Ingredients\n- a\n## Nutrition (per serving)\n${block}`)).toEqual(expected);
  });

  it("reads a horizontal macros table", () => {
    const md = "# X\n## Ingredients\n- a\n## Macros\n| Calories | Protein (g) | Carbohydrates | Fats |\n|---|---|---|---|\n| **770** | 46 | ~94 | 23 |";
    expect(macrosOf(md)).toEqual({ calories: 770, protein: 46, carbs: 94, fat: 23 });
  });

  it("reads a two-column Nutrient | Amount table", () => {
    const md =
      "# X\n## Ingredients\n- a\n## Nutrition\n| Nutrient | Amount |\n| --- | --- |\n| Calories | 770 kcal |\n| Protein | 46 g |\n| Carbs | 94 g |\n| Fat | 23 g |";
    expect(macrosOf(md)).toEqual({ calories: 770, protein: 46, carbs: 94, fat: 23 });
  });

  it("finds a macros table outside a macros section", () => {
    const md = "# X\n| Calories | Protein | Carbs | Fat |\n|---|---|---|---|\n| 500 | 30 | 40 | 20 |\n## Ingredients\n- a";
    expect(macrosOf(md)).toEqual({ calories: 500, protein: 30, carbs: 40, fat: 20 });
  });

  it("divides whole-recipe totals by the servings, with a warning", () => {
    const { draft, warnings } = parse(
      "# X\nServes 4\n## Ingredients\n- a\n## Steps\n1. Go.\n## Nutrition (whole recipe)\nCalories: 3080 kcal\nProtein: 184 g\nCarbs: 376 g\nFat: 92 g",
    );
    expect(draft.macros).toEqual({ calories: 770, protein: 46, carbs: 94, fat: 23 });
    expect(warnings).toEqual(["Macros were for the whole recipe — divided by 4 servings."]);
  });

  it("prefers per-serving values over totals and keeps totals when servings are unknown", () => {
    const both = parse("# X\nServes 2\n## Macros\nTotal: 1000 kcal, 80 g protein\nPer serving: 500 kcal, 40 g protein");
    expect(both.draft.macros).toEqual({ calories: 500, protein: 40, carbs: null, fat: null });
    const unknown = parse("# X\n## Ingredients\n- a\n## Steps\n1. Go.\n## Macros (total)\nCalories: 1200\nProtein: 90 g");
    expect(unknown.draft.macros).toEqual({ calories: 1200, protein: 90, carbs: null, fat: null });
    expect(unknown.warnings).toEqual([PARSE_WARNINGS.totalMacrosUnknownServings]);
  });

  it("does not mistake an ingredient or prose for macros", () => {
    const { draft } = parse("# X\nA dish with 46 g protein per serving.\n## Ingredients\n- 30 g protein powder\n- 2 tbsp fat-free yogurt");
    expect(draft.macros).toEqual({ calories: null, protein: null, carbs: null, fat: null });
    expect(draft.ingredients).toHaveLength(2);
  });
});

describe("parseRecipeText — ingredients and steps", () => {
  it("keeps unicode fractions and strips bullets, checkboxes and numbering", () => {
    const { draft } = parse(
      "# X\n## Ingredients\n- [ ] ½ tsp turmeric\n* [x] ¾ cup curd\n• 1⅓ cups rice\n+ 2 bay leaves\n– 1 star anise\n1. 4 cloves\n2) 1 tsp salt\n  - nested pinch of saffron",
    );
    expect(texts(draft.ingredients)).toEqual([
      "½ tsp turmeric",
      "¾ cup curd",
      "1⅓ cups rice",
      "2 bay leaves",
      "1 star anise",
      "4 cloves",
      "1 tsp salt",
      "nested pinch of saffron",
    ]);
  });

  it("turns bold, colon and heading lines into sub-groups", () => {
    const { draft } = parse(
      "# X\n**Ingredients:**\nFor the marinade:\n- 500 g chicken\n**For the masala**\n- 1 tbsp pepper\n#### Garnish\n- coriander",
    );
    expect(draft.ingredients).toEqual([
      { text: "500 g chicken", group: "For the marinade" },
      { text: "1 tbsp pepper", group: "For the masala" },
      { text: "coriander", group: "Garnish" },
    ]);
  });

  it("strips step markers, joins continuation lines and keeps bold titles", () => {
    const { draft } = parse(
      "# X\n## Method\nStep 1: Heat the oil in a kadai.\nStep 2 - **Temper:** Add mustard seeds.\n3) Add the shallots\n   and fry for 8 min.\n4. Cover.\n   - stir now and then\n   - add water if it sticks",
    );
    expect(texts(draft.steps)).toEqual([
      "Heat the oil in a kadai.",
      "**Temper:** Add mustard seeds.",
      "Add the shallots\nand fry for 8 min.",
      "Cover.\n- stir now and then\n- add water if it sticks",
    ]);
  });

  it("treats blank-line-separated paragraphs as steps when nothing is numbered", () => {
    const { draft } = parse(
      "# X\n## Instructions\nHeat the oil in a heavy pan and add the\nonions; fry until golden.\n\nAdd the chicken and sear it well.\n\nCover and cook for 12 minutes.",
    );
    expect(texts(draft.steps)).toEqual([
      "Heat the oil in a heavy pan and add the onions; fry until golden.",
      "Add the chicken and sear it well.",
      "Cover and cook for 12 minutes.",
    ]);
  });

  it("reads heading-style steps with a paragraph underneath", () => {
    const { draft } = parse(
      "# X\n## Instructions\n### 1. Marinate the chicken\nMix the chicken with curd and spices.\n\n### Step 2: Fry\n- Heat the oil\n- Fry for 10 min",
    );
    expect(texts(draft.steps)).toEqual([
      "**Marinate the chicken:** Mix the chicken with curd and spices.",
      "**Fry:**\n- Heat the oil\n- Fry for 10 min",
    ]);
  });

  it("uses bold lines as step groups when list items follow", () => {
    const { draft } = parse("# X\n## Steps\n**Make the birista**\n1. Slice the onions.\n2. Air fry for 14 min.\n**Dum**\n3. Seal and cook.");
    expect(draft.steps).toEqual([
      { text: "Slice the onions.", group: "Make the birista" },
      { text: "Air fry for 14 min.", group: "Make the birista" },
      { text: "Seal and cook.", group: "Dum" },
    ]);
  });

  it("reads an ingredients table", () => {
    const { draft } = parse("# X\n## Ingredients\n| Ingredient | Amount |\n|---|---|\n| Chicken thighs | 500 g |\n| Black pepper | 1 tbsp |");
    expect(texts(draft.ingredients)).toEqual(["500 g Chicken thighs", "1 tbsp Black pepper"]);
  });

  it("reads inline section labels in a terse note", () => {
    const { draft } = parse("Pepper fry\nIngredients: chicken, pepper, curry leaves, salt\nMethod: Marinate 30 min, then fry for 10 min.\nNote: use thighs");
    expect(draft.title).toBe("Pepper fry");
    expect(texts(draft.ingredients)).toEqual(["chicken", "pepper", "curry leaves", "salt"]);
    expect(texts(draft.steps)).toEqual(["Marinate 30 min, then fry for 10 min."]);
    expect(draft.notes).toBe("use thighs");
  });
});

describe("parseRecipeText — notes", () => {
  it("normalises bullets and keeps specific sub-headings", () => {
    const { draft } = parse("# X\n## Ingredients\n- a\n## 💡 Pro Tips\n* Crush the pepper fresh.\n+ Thighs stay juicy.\n### Storage\nKeeps 3 days in the fridge.");
    expect(draft.notes).toBe("- Crush the pepper fresh.\n- Thighs stay juicy.\n\nStorage:\nKeeps 3 days in the fridge.");
  });
});

describe("parseRecipeText — structure-free input", () => {
  it("uses heuristics when there are no headings", () => {
    const { draft, warnings } = parse(
      "Quick pepper chicken\n500 g chicken\n2 tbsp pepper\na pinch of salt\n1. Marinate the chicken for 30 min.\n2. Fry on high heat for 10 min.",
    );
    expect(draft.title).toBe("Quick pepper chicken");
    expect(texts(draft.ingredients)).toEqual(["500 g chicken", "2 tbsp pepper", "a pinch of salt"]);
    expect(texts(draft.steps)).toEqual(["Marinate the chicken for 30 min.", "Fry on high heat for 10 min."]);
    expect(warnings).toEqual([PARSE_WARNINGS.noHeadings]);
  });

  it("does not crash on empty or blank input", () => {
    for (const input of ["", "   \n\n  ", undefined as unknown as string]) {
      const { draft, warnings } = parse(input);
      expect(draft.title).toBe("Untitled recipe");
      expect(draft.ingredients).toEqual([]);
      expect(warnings).toEqual([PARSE_WARNINGS.empty]);
    }
  });

  it("warns about a missing title, ingredients and steps", () => {
    const { draft, warnings } = parse("## Ingredients\n- 1 cup rice");
    expect(draft.title).toBe("Untitled recipe");
    expect(warnings).toEqual([PARSE_WARNINGS.noTitle, PARSE_WARNINGS.noSteps]);
    expect(parse("# Just a title").warnings).toEqual([PARSE_WARNINGS.noIngredients, PARSE_WARNINGS.noSteps]);
  });
});

describe("parseRecipeText — normalisation", () => {
  it("handles CRLF line endings", () => {
    const { draft } = parse("# Dal\r\n\r\n## Ingredients\r\n- 1 cup dal\r\n- Salt\r\n\r\n## Method\r\n1. Cook it.\r\n");
    expect(texts(draft.ingredients)).toEqual(["1 cup dal", "Salt"]);
    expect(texts(draft.steps)).toEqual(["Cook it."]);
  });

  it("cleans invisible characters, quotes, comments, images, links and quotes", () => {
    const { draft } = parse(
      "> # Recipe: “Mum’s” Dal​\n<!-- hidden -->\n![photo](https://x/y.jpg)\n## Ingredients\n- 1 cup [toor dal](https://shop/dal)\n- 2\tcups water\n## Method\n1. Boil it\\\n   until soft.",
    );
    expect(draft.title).toBe(`"Mum's" Dal`);
    expect(texts(draft.ingredients)).toEqual(["1 cup toor dal", "2 cups water"]);
    expect(texts(draft.steps)).toEqual(["Boil it\nuntil soft."]);
  });

  it("strips markdown and emoji from the title and falls back to the first line", () => {
    expect(parse("## 🍗 **Pepper _Chicken_** ✨\n- 1 tbsp pepper").draft.title).toBe("Pepper Chicken");
    expect(parse("Title: Lemon Rice\n\nIngredients\n- rice").draft.title).toBe("Lemon Rice");
  });
});

describe("buildPrefillText", () => {
  it("combines share-target params", () => {
    expect(buildPrefillText({ title: "Dal", text: "1 cup dal", url: "https://x.com/dal" })).toBe(
      "# Dal\n\n1 cup dal\n\nSource: https://x.com/dal",
    );
    expect(buildPrefillText({ text: "https://x.com/dal" })).toBe("Source: https://x.com/dal");
    expect(buildPrefillText({ title: "Dal", text: "# Dal\n- a" })).toBe("# Dal\n- a");
    expect(hasPrefill({ title: " ", text: "", url: null })).toBe(false);
  });

  it("parses a prefilled share", () => {
    const { draft } = parse(buildPrefillText({ title: "Lemon Rice", text: "Ingredients\n- 1 cup rice\nMethod\n1. Cook.", url: "https://x.com/r" }));
    expect(draft.title).toBe("Lemon Rice");
    expect(draft.source).toBe("https://x.com/r");
    expect(draft.ingredients).toHaveLength(1);
  });
});
