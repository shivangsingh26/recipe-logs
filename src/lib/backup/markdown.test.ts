import { describe, expect, it } from "vitest";
import { normalizeRecipeDraft, withItemIds } from "@/lib/db";
import type { CookLog, MealType, Recipe } from "@/lib/types";
import { buildMarkdownExport, cookLogToMarkdown, formatLongDate, recipeFilePaths } from "./markdown";

let seq = 0;

function log(date: string, mealType: MealType, dishName: string, extra: Partial<CookLog> = {}): CookLog {
  seq += 1;
  return {
    id: `log-${seq}`,
    date,
    mealType,
    recipeId: null,
    dishName,
    notes: "",
    photoId: null,
    createdAt: seq,
    updatedAt: seq,
    ...extra,
  };
}

function recipe(title: string): Recipe {
  const draft = normalizeRecipeDraft({ title, ingredients: ["1 cup rice"], steps: ["Cook for 10 min"] });
  seq += 1;
  return { id: `recipe-${seq}`, ...draft, ...withItemIds(draft), favorite: false, createdAt: seq, updatedAt: seq };
}

describe("cookLogToMarkdown", () => {
  it("groups by month then day, newest first, meals in day order", () => {
    const markdown = cookLogToMarkdown(
      [
        log("2026-09-30", "dinner", "Pepper Chicken Roast"),
        log("2026-10-16", "dinner", "Kacchi Chicken Dum Biryani", {
          notes: "Air fried birista for 14 mins, extra pepper",
          photoId: "p1",
        }),
        log("2026-10-16", "breakfast", "Masala omelette", { notes: "Two eggs\n\nextra chilli" }),
        log("2026-10-15", "snack", "Chai"),
      ],
      { photoPaths: new Map([["p1", "photos/p1.jpg"]]) },
    );

    expect(markdown).toBe(
      [
        "# Cook log",
        "",
        "4 dishes logged, newest first.",
        "",
        "## October 2026",
        "",
        "### Friday, 16 October 2026",
        "",
        "- **Breakfast** · Masala omelette — Two eggs",
        "  extra chilli",
        "- **Dinner** · Kacchi Chicken Dum Biryani — Air fried birista for 14 mins, extra pepper",
        "  [Photo](photos/p1.jpg)",
        "",
        "### Thursday, 15 October 2026",
        "",
        "- **Snack** · Chai",
        "",
        "## September 2026",
        "",
        "### Wednesday, 30 September 2026",
        "",
        "- **Dinner** · Pepper Chicken Roast",
        "",
      ].join("\n"),
    );
  });

  it("omits photo links when no paths are given and handles an empty log", () => {
    expect(cookLogToMarkdown([log("2026-10-16", "lunch", "Dal", { photoId: "p9" })])).not.toContain("[Photo]");
    expect(cookLogToMarkdown([])).toContain("No dishes logged yet.");
  });
});

describe("buildMarkdownExport", () => {
  it("lists recipes A–Z separated by thematic breaks, then the cook log", () => {
    const markdown = buildMarkdownExport(
      { recipes: [recipe("Pepper Chicken"), recipe("Biryani")], logs: [log("2026-10-16", "dinner", "Biryani")] },
      new Date(2026, 9, 16, 9, 5),
    );
    const sections = markdown.split("\n\n---\n\n");
    expect(sections).toHaveLength(4);
    expect(sections[0]).toContain("Exported 16 October 2026 at 09:05 · 2 recipes · 1 cook log entry");
    expect(sections[1]).toMatch(/^# Biryani/);
    expect(sections[2]).toMatch(/^# Pepper Chicken/);
    expect(sections[3]).toMatch(/^# Cook log/);
    expect(markdown.endsWith("\n")).toBe(true);
  });
});

describe("helpers", () => {
  it("formats long dates in English regardless of locale", () => {
    expect(formatLongDate("2026-01-01")).toBe("Thursday, 1 January 2026");
  });

  it("deduplicates recipe file names", () => {
    const a = recipe("Chicken 65");
    const b = recipe("Chicken 65");
    const c = recipe("");
    const paths = recipeFilePaths([a, b, c]);
    expect(new Set(paths.values()).size).toBe(3);
    expect([...paths.values()].sort()).toEqual(["recipes/chicken-65-2.md", "recipes/chicken-65.md", "recipes/untitled-recipe.md"]);
  });
});
