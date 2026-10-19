import { describe, expect, it } from "vitest";
import { MAX_TEXT_CHARS, looksLikeRecipe, readRecipeText, recipeTitle } from "../lib/payload.js";
import { RECIPE } from "./fixtures.js";

describe("readRecipeText", () => {
  it("accepts a plain-text recipe body", () => {
    expect(readRecipeText("text/plain; charset=utf-8", RECIPE)).toEqual({ ok: true, text: RECIPE, title: "Anda Bhurji" });
  });

  it("treats a body without a content type as text", () => {
    expect(readRecipeText(null, RECIPE)).toMatchObject({ ok: true, text: RECIPE });
  });

  it("reads the text or markdown field of a JSON body", () => {
    expect(readRecipeText("application/json", JSON.stringify({ text: RECIPE }))).toMatchObject({ ok: true, text: RECIPE });
    expect(readRecipeText("application/json", JSON.stringify({ markdown: RECIPE }))).toMatchObject({ ok: true, text: RECIPE });
  });

  it("reads the text field of a form body", () => {
    const body = new URLSearchParams({ text: RECIPE }).toString();
    expect(readRecipeText("application/x-www-form-urlencoded", body)).toMatchObject({ ok: true, text: RECIPE });
  });

  it("rejects malformed JSON", () => {
    expect(readRecipeText("application/json", "{text:")).toEqual({ ok: false, error: "bad_json" });
  });

  it("rejects JSON without a text field as empty", () => {
    expect(readRecipeText("application/json", JSON.stringify({ text: 42 }))).toEqual({ ok: false, error: "empty" });
  });

  it("rejects blank text", () => {
    expect(readRecipeText("text/plain", "  \n\t ")).toEqual({ ok: false, error: "empty" });
  });

  it("rejects text over the character limit", () => {
    const long = `${RECIPE}\n${"- 1 tsp salt\n".repeat(MAX_TEXT_CHARS / 10)}`;
    expect(readRecipeText("text/plain", long)).toEqual({ ok: false, error: "too_large" });
  });

  it("rejects clipboard text that is not a recipe", () => {
    expect(readRecipeText("text/plain", "hunter2")).toEqual({ ok: false, error: "not_a_recipe" });
    expect(readRecipeText("text/plain", "Ingredients are the key to good food.")).toEqual({
      ok: false,
      error: "not_a_recipe",
    });
  });

  it("normalises line endings and drops control characters", () => {
    const messy = `\u0000${RECIPE.replace(/\n/g, "\r\n")}\u0007`;
    expect(readRecipeText("text/plain", messy)).toMatchObject({ ok: true, text: RECIPE });
  });
});

describe("looksLikeRecipe", () => {
  it("needs an ingredients section and list items", () => {
    expect(looksLikeRecipe(RECIPE)).toBe(true);
    expect(looksLikeRecipe("Ingredients:\n• rice\n• dal")).toBe(true);
    expect(looksLikeRecipe("- milk\n- eggs\n- bread")).toBe(false);
  });
});

describe("recipeTitle", () => {
  it("uses the first heading, even inside a copied chat reply", () => {
    const reply = `Sure! Here it is:\n\n\`\`\`markdown\n${RECIPE}\n\`\`\`\n\nEnjoy!`;
    expect(recipeTitle(reply)).toBe("Anda Bhurji");
  });

  it("falls back to the first line without markdown decoration", () => {
    expect(recipeTitle("**Masala Oats**\nIngredients:\n- oats")).toBe("Masala Oats");
  });

  it("caps long titles", () => {
    expect(recipeTitle(`# ${"Very ".repeat(60)}Long`).length).toBeLessThanOrEqual(120);
  });
});
