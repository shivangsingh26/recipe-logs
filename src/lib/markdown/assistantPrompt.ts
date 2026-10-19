// Instructions for a chat assistant (a Gemini Gem, a ChatGPT custom GPT, a Claude project)
// so that the recipes it hands over paste straight into CulinaryLog. The example is rendered
// by recipeToMarkdown, so it always matches what the importer reads back.

import type { RecipeDraft } from "@/lib/types";
import { recipeToMarkdown } from "./recipeMarkdown";

export const ASSISTANT_NAME = "CulinaryLog Chef";

const SAMPLE: RecipeDraft = {
  title: "Anda Bhurji",
  description: "Spicy scrambled eggs with onion, tomato and green chilli.",
  categories: ["High-Protein", "Breakfast", "Quick Meal"],
  prepMinutes: 5,
  cookMinutes: 10,
  servings: 2,
  macros: { calories: 260, protein: 17, carbs: 8, fat: 18 },
  ingredients: [
    { text: "1 tbsp ghee", group: "Masala" },
    { text: "1 onion, finely chopped", group: "Masala" },
    { text: "1 tomato, chopped", group: "Masala" },
    { text: "1 green chilli, chopped", group: "Masala" },
    { text: "¼ tsp turmeric", group: "Masala" },
    { text: "4 eggs, beaten", group: "Eggs" },
    { text: "Salt and black pepper to taste", group: "Eggs" },
  ],
  steps: [
    { text: "**Masala:** Heat the ghee and sauté the onion for 4 min until soft." },
    { text: "Add the tomato, chilli and turmeric and cook for 3 min." },
    { text: "**Eggs:** Pour in the eggs and stir gently for 2 min until just set." },
  ],
  notes: "- Finish with coriander and a squeeze of lemon.\n- Changed in chat: extra chilli, ghee instead of oil.",
  source: "",
};

export function assistantInstructions(): string {
  return [
    "You are my cooking partner. We brainstorm and refine recipes together in normal conversation.",
    "",
    'When I say "save it", "send to CulinaryLog" or ask for the final recipe, reply with ONLY that recipe inside a single markdown code block, written exactly in the format below. No text before or after the code block.',
    "",
    "Format rules:",
    '- "# Title" on the first line, then an optional one-line description.',
    "- Prep time and cook time in minutes; servings as a number.",
    "- Categories: a few short tags separated by commas (e.g. High-Protein, Dinner, Quick Meal, Biryani, Air Fryer).",
    "- Macros are PER SERVING: calories in kcal; protein, carbs and fat in grams. Estimate when unsure, but keep the table.",
    '- Group ingredients or steps under "### Section" headings when the recipe has parts (Marinade, Rice, Dum…).',
    "- One ingredient per bullet, with its quantity. One action per numbered step.",
    '- Write every duration in a step as a number and unit ("14 min", "1 hr 30 min"); the app turns them into timers.',
    '- Put tips, variations, storage and what we changed during our chat under "## Notes & Tips".',
    "- When I ask to update a recipe I saved before, keep exactly the same title.",
    "",
    "Example of the exact format:",
    "",
    recipeToMarkdown(SAMPLE).trimEnd(),
  ].join("\n");
}
