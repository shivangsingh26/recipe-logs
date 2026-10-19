import { describe, expect, it } from "vitest";
import { recipeToMarkdown } from "@/lib/markdown/recipeMarkdown";
import { SEED_RECIPES } from "@/lib/seeds";
import { unwrapAssistantReply } from "./assistant";
import { parseRecipeText } from "./parseRecipe";

const RECIPE = `# Paneer Tikka (Air Fryer)

Smoky, charred paneer cubes.

- **Prep time:** 20 min
- **Servings:** 2

## Ingredients
- 250 g paneer, cubed
- 3 tbsp hung curd

## Instructions
1. Marinate for 30 min.
2. Air fry at 200°C for 12 min.

## Notes & Tips
- Skewer with onions.`;

describe("unwrapAssistantReply", () => {
  it("drops a trailing assistant sign-off", () => {
    const reply = `Absolutely! Here's the final version:\n\n${RECIPE}\n\nEnjoy your cooking! Let me know if you want a vegan version.`;
    const { draft } = parseRecipeText(reply);
    expect(draft.title).toBe("Paneer Tikka (Air Fryer)");
    expect(draft.notes).toBe("- Skewer with onions.");
  });

  it("drops several sign-off paragraphs", () => {
    const reply = `${RECIPE}\n\nHappy cooking!\n\nWould you like a dessert to go with it?`;
    expect(parseRecipeText(reply).draft.notes).toBe("- Skewer with onions.");
  });

  it("extracts the recipe from a ```markdown fence with chatter around it", () => {
    const reply = `Sure — here it is:\n\n\`\`\`markdown\n${RECIPE}\n\`\`\`\n\nWant me to tweak the spice level?`;
    const { draft } = parseRecipeText(reply);
    expect(draft.title).toBe("Paneer Tikka (Air Fryer)");
    expect(draft.description).toBe("Smoky, charred paneer cubes.");
    expect(draft.ingredients).toHaveLength(2);
    expect(draft.steps).toHaveLength(2);
    expect(draft.notes).toBe("- Skewer with onions.");
  });

  it("handles a bare fence and ~~~ fences", () => {
    expect(unwrapAssistantReply("```\n" + RECIPE + "\n```")).toBe(RECIPE);
    expect(unwrapAssistantReply("~~~md\n" + RECIPE + "\n~~~")).toBe(RECIPE);
  });

  it("ignores fences that are not recipes", () => {
    const text = `${RECIPE}\n\n\`\`\`\nnot a recipe\n\`\`\``;
    expect(unwrapAssistantReply(text)).toBe(text);
  });

  it("keeps real tips that happen to start like a sign-off", () => {
    const text = `${RECIPE}\n\nEnjoy with raita and onion salad.`;
    expect(unwrapAssistantReply(text)).toBe(text);
    const bullet = `${RECIPE}\n\n- Let me know-how: soak the rice first.`;
    expect(unwrapAssistantReply(bullet)).toBe(bullet);
  });

  it("leaves canonical Markdown untouched", () => {
    for (const seed of SEED_RECIPES) {
      const markdown = recipeToMarkdown(seed);
      expect(unwrapAssistantReply(markdown)).toBe(markdown.replace(/\n+$/, ""));
    }
  });
});
