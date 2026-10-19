// Starter recipes written into the vault the first time the database is created.
// Macros are per-serving estimates from standard nutrition tables.

import { newId } from "./ids";
import type { Recipe, RecipeDraft } from "./types";

type SeedDraft = RecipeDraft & { seedKey: string };

type Section = [group: string | undefined, items: string[]];

function sections(...groups: Section[]): Array<{ text: string; group?: string }> {
  return groups.flatMap(([group, items]) => items.map((text) => (group ? { text, group } : { text })));
}

export const SEED_RECIPES: readonly SeedDraft[] = [
  {
    seedKey: "kacchi-chicken-dum-biryani",
    title: "Kacchi Chicken Dum Biryani (5L Cooker & Air Fryer Method)",
    description:
      "Raw-marinated chicken and 70%-cooked basmati sealed in a 5-litre pressure cooker without the whistle and dum-cooked together. Air-fried birista replaces deep-fried onions. Marinate for at least 2 hours.",
    categories: ["Biryani", "High-Protein", "Dinner"],
    prepMinutes: 30,
    cookMinutes: 60,
    servings: 4,
    macros: { calories: 770, protein: 46, carbs: 94, fat: 23 },
    ingredients: sections(
      ["Birista (air fryer)", ["3 large onions (≈450 g), thinly sliced", "1 tbsp oil", "1 pinch salt"]],
      [
        "Marinade",
        [
          "750 g chicken, bone-in curry cut (thighs & drumsticks)",
          "1 cup (250 g) thick hung curd, whisked",
          "2 tbsp ginger-garlic paste",
          "1½ tsp Kashmiri red chilli powder",
          "½ tsp turmeric",
          "2 tsp biryani masala",
          "1 tsp garam masala",
          "4 green chillies, slit",
          "½ cup mint leaves, chopped",
          "½ cup coriander leaves, chopped",
          "2 tbsp lemon juice",
          "1 tbsp ghee, melted",
          "1½ tsp salt",
          "Half of the birista, crushed",
        ],
      ],
      [
        "Rice",
        [
          "2 cups (400 g) aged basmati rice",
          "2.5 L water",
          "1 tbsp salt",
          "2 bay leaves",
          "4 green cardamom",
          "4 cloves",
          "1-inch cinnamon stick",
          "1 star anise",
          "1 tsp shahi jeera",
        ],
      ],
      [
        "Layering",
        [
          "2 tbsp ghee (1 for the base, 1 to drizzle)",
          "3 tbsp water",
          "Pinch of saffron soaked in ¼ cup warm milk",
          "Remaining birista",
          "2 tbsp mint leaves",
          "2 tbsp coriander leaves",
          "½ tsp kewra water (optional)",
        ],
      ],
    ),
    steps: sections(
      [
        "Prep",
        [
          "**Make the birista:** Toss the sliced onions with 1 tbsp oil and a pinch of salt. Air fry at 160°C for 14 min, shaking the basket every few minutes, until deep golden. Spread on a plate to crisp up.",
          "**Marinate:** In a large bowl, mix the chicken with the curd, ginger-garlic paste, chilli powder, turmeric, biryani masala, garam masala, green chillies, mint, coriander, lemon juice, 1 tbsp ghee, salt and half the birista (crushed). Cover and refrigerate for at least 2 hours — overnight is best.",
          "**Soak the rice:** Rinse the basmati until the water runs clear, then soak for 30 min.",
          "**Parboil to 70%:** Bring 2.5 L water to a rolling boil with 1 tbsp salt and the whole spices. Add the drained rice and boil for 5–6 min, until a grain breaks with a firm white core. Drain immediately.",
        ],
      ],
      [
        "Dum",
        [
          "**Layer the cooker:** Grease the base of the 5 L cooker with 1 tbsp ghee. Spread the chicken and all of its marinade in an even layer, then pour 3 tbsp water around the edge. Spoon the rice over the chicken without pressing it down.",
          "**Finish the top:** Scatter the remaining birista, mint and coriander. Drizzle over the saffron milk, kewra water and the last 1 tbsp of melted ghee.",
          "**Seal:** Close the lid with the gasket in place but WITHOUT the whistle. Cook on high heat for 7 min, until steam streams steadily from the vent.",
          "**Dum:** Set the cooker on a tawa (flat griddle) over the lowest flame and cook for 25 min.",
          "**Rest:** Turn off the heat and leave it sealed for 10 min. Open, check that a piece near the centre is cooked through, then fluff gently from the sides and serve with raita.",
        ],
      ],
    ),
    notes: [
      "- Bone-in thighs and drumsticks stay juicy through the long dum. With breast, cut bigger pieces and dum for 20 minutes instead.",
      "- Rice at 70% is make-or-break: under-boiled stays hard, over-boiled turns mushy under the steam.",
      "- No whistle means no pressure build-up; the cooker works as a heavy sealed dum pot. Never add the weight or the rice overcooks and the base can burn.",
      "- The tawa underneath diffuses the heat so the marinade does not scorch.",
      "- Food safety: chicken should reach 74°C (165°F) inside. If a piece is pink near the bone, reseal and dum for another 5 minutes.",
      "- Extra birista keeps crisp for a week in an airtight jar.",
    ].join("\n"),
    source: "",
  },
  {
    seedKey: "south-indian-black-pepper-chicken-roast",
    title: "South Indian Black Pepper Chicken Roast (Dry Fry)",
    description:
      "Kerala/Chettinad-style dry roast: chicken seared with shallots and curry leaves, then finished with freshly crushed black pepper and fennel until dark, dry and clinging.",
    categories: ["High-Protein", "Dinner", "Low-Carb"],
    prepMinutes: 15,
    cookMinutes: 35,
    servings: 3,
    macros: { calories: 340, protein: 35, carbs: 14, fat: 16 },
    ingredients: sections(
      [
        "Marinade",
        [
          "500 g boneless chicken thighs, bite-size pieces (or 600 g bone-in)",
          "½ tsp turmeric",
          "1 tsp freshly crushed black pepper",
          "½ tbsp ginger-garlic paste",
          "1 tbsp lemon juice",
          "¾ tsp salt",
        ],
      ],
      ["Pepper masala", ["1½ tbsp black peppercorns", "1 tsp fennel seeds", "½ tsp cumin seeds"]],
      [
        "Roast",
        [
          "2 tbsp coconut oil",
          "½ tsp mustard seeds",
          "2 sprigs curry leaves (plus 1 to finish)",
          "2 green chillies, slit",
          "12 shallots (≈150 g), thinly sliced, or 1 large onion",
          "½ tbsp ginger-garlic paste",
          "1½ tsp coriander powder",
          "½ tsp Kashmiri chilli powder",
          "½ tsp garam masala",
          "Salt to taste",
          "Coriander leaves and a squeeze of lemon, to finish",
        ],
      ],
    ),
    steps: sections([
      undefined,
      [
        "**Marinate:** Toss the chicken with the turmeric, 1 tsp pepper, ½ tbsp ginger-garlic paste, lemon juice and salt. Rest for 30 min.",
        "**Toast the pepper masala:** Dry-roast the peppercorns, fennel and cumin on low heat for 2 min until fragrant. Cool, then crush coarsely — gritty, not powdery.",
        "**Temper:** Heat the coconut oil in a heavy kadai. Add the mustard seeds; when they splutter, add the curry leaves and green chillies.",
        "**Shallots:** Add the shallots and sauté on medium heat for 8 min, until deep golden at the edges.",
        "**Aromatics:** Stir in the remaining ginger-garlic paste and cook for 1 min, until the raw smell is gone. Add the coriander and chilli powders and stir for 30 sec.",
        "**Sear:** Add the chicken, turn the heat to high and sear for 5 min, stirring now and then, until the pieces turn opaque.",
        "**Cook through:** Cover and cook on medium-low for 12 min. The chicken releases its own juices; add 2–3 tbsp water only if it starts to stick.",
        "**Dry roast:** Uncover, add the crushed pepper masala and garam masala, and roast on medium-high for 10 min, stirring often, until the masala turns dark and clings to the chicken with no gravy left.",
        "**Finish:** Add a fresh sprig of curry leaves, a squeeze of lemon and the coriander leaves. For extra-crisp edges, air fry at 200°C for 4 min.",
      ],
    ]),
    notes: [
      "- Crush the pepper fresh; pre-ground pepper tastes flat here. 1 tbsp of peppercorns is medium heat, 2 tbsp is fiery.",
      "- Thighs stay juicy. With breast, shorten the covered cook to 8 minutes.",
      "- Shallots (sambar onions) give the classic sweetness; one large onion works in a pinch.",
      "- Coconut oil gives the Kerala aroma; any neutral oil works.",
      "- Serve with ghee rice, appam, Malabar parotta or rasam rice. For a low-carb plate, pair with a cucumber-onion salad.",
    ].join("\n"),
    source: "",
  },
];

/** Materialises the starter recipes as full records with fresh ids. */
export function buildSeedRecipes(now: number = Date.now(), only?: ReadonlySet<string>): Recipe[] {
  return SEED_RECIPES.filter((seed) => !only || only.has(seed.seedKey)).map((seed, index) => ({
    id: newId(),
    title: seed.title,
    description: seed.description,
    categories: [...seed.categories],
    prepMinutes: seed.prepMinutes,
    cookMinutes: seed.cookMinutes,
    servings: seed.servings,
    macros: { ...seed.macros },
    ingredients: seed.ingredients.map((i) => ({ id: newId(), text: i.text, ...(i.group ? { group: i.group } : {}) })),
    steps: seed.steps.map((s) => ({ id: newId(), text: s.text, ...(s.group ? { group: s.group } : {}) })),
    notes: seed.notes,
    source: seed.source,
    favorite: false,
    seedKey: seed.seedKey,
    // Older seeds sort below newer ones by a millisecond so the list order is stable.
    createdAt: now - index,
    updatedAt: now - index,
  }));
}
