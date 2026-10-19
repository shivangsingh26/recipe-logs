// Shared test data: a recipe in the shape the CulinaryLog Gem hands over.

export const RECIPE = [
  "# Anda Bhurji",
  "",
  "Spicy scrambled eggs with onion, tomato and green chilli.",
  "",
  "**Prep:** 5 min · **Cook:** 10 min · **Serves:** 2",
  "",
  "## Ingredients",
  "",
  "- 1 tbsp ghee",
  "- 1 onion, finely chopped",
  "- 4 eggs, beaten",
  "",
  "## Method",
  "",
  "1. Heat the ghee and sauté the onion for 4 min until soft.",
  "2. Pour in the eggs and stir gently for 2 min until just set.",
].join("\n");

/** Same dish, refined in a later round of the chat. */
export const RECIPE_V2 = RECIPE.replace("4 eggs", "5 eggs");
