import { describe, expect, it } from "vitest";
import { parseRecipeText } from "@/lib/parser/parseRecipe";
import { assistantInstructions } from "./assistantPrompt";

describe("assistantInstructions", () => {
  const instructions = assistantInstructions();
  const example = instructions.slice(instructions.indexOf("# Anda Bhurji"));

  it("embeds an example the importer reads back completely", () => {
    const { draft, warnings } = parseRecipeText(example);
    expect(warnings).toEqual([]);
    expect(draft.title).toBe("Anda Bhurji");
    expect(draft.categories).toEqual(["High-Protein", "Breakfast", "Quick Meal"]);
    expect([draft.prepMinutes, draft.cookMinutes, draft.servings]).toEqual([5, 10, 2]);
    expect(draft.macros).toEqual({ calories: 260, protein: 17, carbs: 8, fat: 18 });
    expect(draft.ingredients.map((i) => i.group)).toEqual(["Masala", "Masala", "Masala", "Masala", "Masala", "Eggs", "Eggs"]);
    expect(draft.steps).toHaveLength(3);
  });

  it("parses a reply that follows the instructions (fenced, with chatter around it)", () => {
    const reply = `Here you go!\n\n\`\`\`markdown\n${example}\n\`\`\`\n\nEnjoy!`;
    const { draft } = parseRecipeText(reply);
    expect(draft.title).toBe("Anda Bhurji");
    expect(draft.notes).toContain("Changed in chat");
    expect(draft.notes).not.toContain("Enjoy");
  });
});
