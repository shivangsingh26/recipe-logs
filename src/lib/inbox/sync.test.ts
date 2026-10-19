import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLog, createRecipe, db, getRecipe, normalizeRecipeDraft } from "@/lib/db";
import { recipeToMarkdown } from "@/lib/markdown/recipeMarkdown";
import { parseRecipeText } from "@/lib/parser/parseRecipe";
import type { RecipeDraft } from "@/lib/types";
import type { InboxClient, InboxItem } from "./client";
import { createProcessedIds, importInboxItem, syncInbox, undoInboxOutcome, type ProcessedIds } from "./sync";

function draft(title: string, ingredients: string[], steps: string[]): RecipeDraft {
  return normalizeRecipeDraft({
    title,
    servings: 2,
    ingredients: ingredients.map((text) => ({ text })),
    steps: steps.map((text) => ({ text })),
  });
}

const BHURJI = recipeToMarkdown(draft("Anda Bhurji", ["4 eggs", "1 onion"], ["Sauté the onion for 4 min.", "Add the eggs."]));
const BHURJI_V2 = recipeToMarkdown(
  draft("anda bhurji", ["5 eggs", "1 onion", "1 chilli"], ["Sauté the onion for 5 min.", "Add the eggs."]),
);
const DAL = recipeToMarkdown(draft("Dal Tadka", ["1 cup dal"], ["Boil for 20 min."]));

function item(id: string, text: string, receivedAt = 1): InboxItem {
  return { id, text, title: "", source: "shortcut", receivedAt };
}

function fakeClient(items: InboxItem[], options: { failAck?: boolean } = {}) {
  const acked: string[][] = [];
  const client: InboxClient = {
    list: async () => items,
    ack: async (ids) => {
      if (options.failAck) throw new Error("offline");
      acked.push(ids);
    },
    pair: async () => {},
    unpair: async () => {},
  };
  return { client, acked };
}

function memoryIds(): ProcessedIds {
  const ids = new Set<string>();
  return { has: (id) => ids.has(id), add: (id) => void ids.add(id) };
}

beforeEach(async () => {
  await Promise.all([db.recipes.clear(), db.logs.clear(), db.cookState.clear()]);
});

describe("importInboxItem", () => {
  it("saves a new recipe parsed like Paste & save", async () => {
    const outcome = await importInboxItem(item("1", BHURJI));
    expect(outcome.kind).toBe("created");
    const saved = outcome.kind === "created" ? await getRecipe(outcome.recipe.id) : undefined;
    expect(saved?.title).toBe("Anda Bhurji");
    expect(saved?.ingredients.map((i) => i.text)).toEqual(["4 eggs", "1 onion"]);
    expect(saved?.steps).toHaveLength(2);
  });

  it("updates the recipe with the same title and keeps its cook history", async () => {
    const existing = await createRecipe(draft("Anda Bhurji", ["4 eggs"], ["Cook."]));
    const log = await createLog({ date: "2026-10-18", mealType: "breakfast", recipeId: existing.id, dishName: "Anda Bhurji", notes: "" });

    const outcome = await importInboxItem(item("1", BHURJI_V2));

    expect(outcome.kind).toBe("updated");
    expect(await db.recipes.count()).toBe(1);
    const saved = await getRecipe(existing.id);
    expect(saved?.ingredients.map((i) => i.text)).toEqual(["5 eggs", "1 onion", "1 chilli"]);
    expect((await db.logs.get(log.id))?.recipeId).toBe(existing.id);
    if (outcome.kind === "updated") expect(outcome.previous.recipe.ingredients.map((i) => i.text)).toEqual(["4 eggs"]);
  });

  it("keeps the vault's spelling of the title when only the case differs", async () => {
    const existing = await createRecipe(draft("Anda Bhurji", ["4 eggs"], ["Cook."]));
    await importInboxItem(item("1", BHURJI_V2));
    expect((await getRecipe(existing.id))?.title).toBe("Anda Bhurji");
  });

  it("never matches untitled recipes to each other", async () => {
    const untitled = "## Ingredients\n\n- 1 cup rice\n- 2 cups water\n\n## Method\n\n1. Boil for 12 min.";
    expect(parseRecipeText(untitled).draft.title).toBe("Untitled recipe");
    await importInboxItem(item("1", untitled));
    const second = await importInboxItem(item("2", untitled));
    expect(second.kind).toBe("created");
    expect(await db.recipes.count()).toBe(2);
  });

  it("leaves text it cannot read as a recipe unsaved", async () => {
    const outcome = await importInboxItem(item("1", "Ingredients are what matter most."));
    expect(outcome).toEqual({ kind: "unreadable", itemId: "1", text: "Ingredients are what matter most." });
    expect(await db.recipes.count()).toBe(0);
  });
});

describe("syncInbox", () => {
  it("imports waiting recipes in order and acknowledges them", async () => {
    const { client, acked } = fakeClient([item("1", BHURJI, 1), item("2", DAL, 2)]);
    const outcomes = await syncInbox(client, memoryIds());
    expect(outcomes.map((o) => o.kind)).toEqual(["created", "created"]);
    expect(acked).toEqual([["1", "2"]]);
  });

  it("acknowledges but does not re-import items it already imported", async () => {
    const ids = memoryIds();
    ids.add("1");
    const { client, acked } = fakeClient([item("1", BHURJI), item("2", DAL)]);
    const outcomes = await syncInbox(client, ids);
    expect(outcomes).toHaveLength(1);
    expect(acked).toEqual([["1", "2"]]);
    expect(await db.recipes.count()).toBe(1);
  });

  it("survives a lost acknowledgement without duplicating the recipe", async () => {
    const ids = memoryIds();
    const failing = fakeClient([item("1", BHURJI)], { failAck: true });
    expect(await syncInbox(failing.client, ids)).toHaveLength(1);
    const retry = fakeClient([item("1", BHURJI)]);
    expect(await syncInbox(retry.client, ids)).toHaveLength(0);
    expect(retry.acked).toEqual([["1"]]);
    expect(await db.recipes.count()).toBe(1);
  });

  it("does nothing when the inbox is empty", async () => {
    const { client, acked } = fakeClient([]);
    expect(await syncInbox(client, memoryIds())).toEqual([]);
    expect(acked).toEqual([]);
  });
});

describe("undoInboxOutcome", () => {
  it("removes a recipe that was just created", async () => {
    const outcome = await importInboxItem(item("1", BHURJI));
    await undoInboxOutcome(outcome);
    expect(await db.recipes.count()).toBe(0);
  });

  it("puts back the previous version of an updated recipe", async () => {
    const existing = await createRecipe(draft("Anda Bhurji", ["4 eggs"], ["Cook."]));
    const outcome = await importInboxItem(item("1", BHURJI_V2));
    await undoInboxOutcome(outcome);
    expect(await getRecipe(existing.id)).toEqual(existing);
  });
});

describe("createProcessedIds", () => {
  it("remembers ids in storage and caps how many it keeps", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
    };
    const ids = createProcessedIds(storage, 3);
    for (const id of ["a", "b", "c", "d"]) ids.add(id);
    const reloaded = createProcessedIds(storage, 3);
    expect(["a", "b", "c", "d"].map((id) => reloaded.has(id))).toEqual([false, true, true, true]);
  });
});
