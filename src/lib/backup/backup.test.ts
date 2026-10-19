import "fake-indexeddb/auto";
import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createLog,
  createRecipe,
  db,
  deleteLog,
  deleteRecipe,
  normalizeRecipeDraft,
  restoreStarterRecipes,
  toggleIngredientChecked,
  updateRecipe,
  draftFromRecipe,
} from "@/lib/db";
import { buildSeedRecipes } from "@/lib/seeds";
import type { CookLog, PhotoInput } from "@/lib/types";
import { buildBackupDocument, readSnapshot } from "./document";
import { BackupError, eraseAllData, loadBackup, restoreBackup } from "./restore";
import type { BackupDocument, DataSnapshot } from "./types";
import { buildBackupZip } from "./zip";

async function clearAll() {
  await Promise.all([db.recipes.clear(), db.logs.clear(), db.photos.clear(), db.cookState.clear()]);
}

beforeEach(clearAll);

/** Fake JPEG bytes (SOI marker + a deterministic pattern). */
function jpeg(size: number, seed: number): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  for (let i = 2; i < size; i++) bytes[i] = (i * 31 + seed) % 256;
  return bytes.buffer;
}

function photo(seed: number): PhotoInput {
  return { mime: "image/jpeg", data: jpeg(6000, seed), thumb: jpeg(900, seed + 1), width: 1600, height: 1200 };
}

async function seedData() {
  const biryani = await createRecipe(
    normalizeRecipeDraft({
      title: "Kacchi Chicken Dum Biryani",
      categories: ["Biryani", "High-Protein"],
      ingredients: ["750 g chicken", "2 cups basmati"],
      steps: ["Marinate for 2 hours", "Dum for 25 min"],
      macros: { calories: 770, protein: 46 },
    }),
  );
  const pepper = await createRecipe(
    normalizeRecipeDraft({ title: "Black Pepper Chicken Roast", ingredients: ["500 g chicken"], steps: ["Roast 10 min"] }),
  );
  const dinner = await createLog(
    {
      date: "2026-10-16",
      mealType: "dinner",
      recipeId: biryani.id,
      dishName: biryani.title,
      notes: "Air fried birista for 14 mins, extra pepper",
    },
    photo(1),
  );
  const lunch = await createLog({ date: "2026-10-15", mealType: "lunch", recipeId: null, dishName: "Masala omelette", notes: "" });
  const roast = await createLog(
    { date: "2026-09-30", mealType: "dinner", recipeId: pepper.id, dishName: pepper.title, notes: "" },
    photo(7),
  );
  await toggleIngredientChecked(biryani.id, biryani.ingredients[0].id);
  return { biryani, pepper, dinner, lunch, roast };
}

/** Snapshot with stable ordering and plain byte arrays, for deep equality. */
async function comparable(snapshot?: DataSnapshot) {
  const s = snapshot ?? (await readSnapshot());
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
  return {
    recipes: [...s.recipes].sort(byId),
    logs: [...s.logs].sort(byId),
    cookState: [...s.cookState].sort((a, b) => a.recipeId.localeCompare(b.recipeId)),
    photos: [...s.photos]
      .sort(byId)
      .map((p) => ({ ...p, data: [...new Uint8Array(p.data)], thumb: [...new Uint8Array(p.thumb)] })),
  };
}

function zipFile(bytes: Uint8Array): File {
  return new File([bytes.slice()], "culinarylog-backup-2026-10-16.zip", { type: "application/zip" });
}

function jsonFile(value: unknown): File {
  return new File([typeof value === "string" ? value : JSON.stringify(value)], "backup.json", {
    type: "application/json",
  });
}

describe("zip backup", () => {
  it("contains the JSON, photos, recipe Markdown, cook log and README", async () => {
    const { dinner, roast } = await seedData();
    const zip = buildBackupZip(await readSnapshot(), new Date(2026, 9, 16, 21, 40));
    const methods = new Map<string, number>();
    const entries = unzipSync(zip, {
      filter: (file) => {
        methods.set(file.name, file.compression);
        return true;
      },
    });

    expect(Object.keys(entries).sort()).toEqual(
      [
        "README.txt",
        "cook-log.md",
        "culinarylog-backup.json",
        `photos/${dinner.photoId}-thumb.jpg`,
        `photos/${dinner.photoId}.jpg`,
        `photos/${roast.photoId}-thumb.jpg`,
        `photos/${roast.photoId}.jpg`,
        "recipes/black-pepper-chicken-roast.md",
        "recipes/kacchi-chicken-dum-biryani.md",
      ].sort(),
    );
    // JPEGs stored as-is, text deflated.
    expect(methods.get(`photos/${dinner.photoId}.jpg`)).toBe(0);
    expect(methods.get("culinarylog-backup.json")).toBe(8);

    const doc = JSON.parse(strFromU8(entries["culinarylog-backup.json"])) as BackupDocument;
    expect(doc).toMatchObject({
      format: "culinarylog-backup",
      version: 1,
      app: "CulinaryLog",
      counts: { recipes: 2, logs: 3, photos: 2 },
    });
    expect(typeof doc.appVersion).toBe("string");
    expect(doc.photos[0].file).toMatch(/^photos\/.+\.jpg$/);
    expect(doc.photos[0].data).toBeUndefined();
    expect(new Uint8Array(entries[`photos/${dinner.photoId}.jpg`])).toEqual(new Uint8Array(jpeg(6000, 1)));

    const cookLog = strFromU8(entries["cook-log.md"]);
    expect(cookLog).toContain(
      "- **Dinner** · Kacchi Chicken Dum Biryani — Air fried birista for 14 mins, extra pepper",
    );
    expect(cookLog).toContain(`[Photo](photos/${dinner.photoId}.jpg)`);
    expect(cookLog.indexOf("## October 2026")).toBeLessThan(cookLog.indexOf("## September 2026"));
    expect(strFromU8(entries["recipes/kacchi-chicken-dum-biryani.md"])).toContain("# Kacchi Chicken Dum Biryani");
    expect(strFromU8(entries["README.txt"])).toContain("Restore from backup");
  });

  it("gives recipes with the same title unique file names", async () => {
    await createRecipe(normalizeRecipeDraft({ title: "Dal Tadka" }));
    await createRecipe(normalizeRecipeDraft({ title: "Dal tadka!" }));
    await createRecipe(normalizeRecipeDraft({ title: "Dal Tadka" }));
    const names = Object.keys(unzipSync(buildBackupZip(await readSnapshot()))).filter((n) => n.startsWith("recipes/"));
    expect(names.sort()).toEqual(["recipes/dal-tadka-2.md", "recipes/dal-tadka-3.md", "recipes/dal-tadka.md"]);
  });

  it("round-trips everything with replace, including photo bytes", async () => {
    await seedData();
    const before = await comparable();
    const zip = buildBackupZip(await readSnapshot());

    await createRecipe(normalizeRecipeDraft({ title: "Something new since the backup" }));
    const backup = await loadBackup(zipFile(zip));
    expect(backup.source).toBe("zip");
    expect(backup.photos).toHaveLength(2);

    const result = await restoreBackup(backup, "replace");
    expect(result).toMatchObject({ recipesAdded: 2, recipesUpdated: 0, logsAdded: 3, logsUpdated: 0, photos: 2, skipped: 0 });
    expect(await comparable()).toEqual(before);
  });

  it("accepts a zip whose files sit one folder down", async () => {
    await seedData();
    const entries = unzipSync(buildBackupZip(await readSnapshot()));
    const nested = Object.fromEntries(Object.entries(entries).map(([name, data]) => [`My backup/${name}`, data]));
    const { zipSync } = await import("fflate");
    const backup = await loadBackup(zipFile(zipSync(nested)));
    expect(backup.photos).toHaveLength(2);
  });
});

describe("JSON export", () => {
  it("embeds photos as data URLs and restores them byte for byte", async () => {
    await seedData();
    const before = await comparable();
    const doc = buildBackupDocument(await readSnapshot(), { photos: "embed" });
    expect(doc.photos[0].data).toMatch(/^data:image\/jpeg;base64,/);
    expect(doc.photos[0].file).toBeUndefined();

    await clearAll();
    const backup = await loadBackup(jsonFile(doc));
    expect(backup.source).toBe("json");
    await restoreBackup(backup, "replace");
    expect(await comparable()).toEqual(before);
  });

  it("without photos: replace drops the photo links, merge keeps this device's photos", async () => {
    const { dinner } = await seedData();
    const doc = buildBackupDocument(await readSnapshot(), { photos: "omit" });
    expect(doc.photos).toEqual([]);
    const backup = await loadBackup(jsonFile(doc));
    expect(backup.missingPhotos).toBe(2);

    const merged = await restoreBackup(backup, "merge");
    expect(merged.photos).toBe(0);
    expect((await db.logs.get(dinner.id))?.photoId).toBe(dinner.photoId);
    expect(await db.photos.count()).toBe(2);

    await restoreBackup(backup, "replace");
    expect((await db.logs.get(dinner.id))?.photoId).toBeNull();
    expect(await db.photos.count()).toBe(0);
  });
});

describe("merge", () => {
  it("is idempotent: restoring the same backup twice adds nothing", async () => {
    await seedData();
    const backup = await loadBackup(zipFile(buildBackupZip(await readSnapshot())));
    const before = await comparable();

    const first = await restoreBackup(backup, "merge");
    expect(first).toMatchObject({ recipesAdded: 0, recipesUpdated: 0, logsAdded: 0, logsUpdated: 0, photos: 0 });
    const second = await restoreBackup(backup, "merge");
    expect(second).toMatchObject({ recipesAdded: 0, recipesUpdated: 0, logsAdded: 0, logsUpdated: 0, photos: 0 });
    expect(second.skipped).toBe(2 + 3 + 2);
    expect(await comparable()).toEqual(before);
  });

  it("adds back deleted records and relinks the entries of a restored recipe", async () => {
    const { pepper, dinner, roast } = await seedData();
    const backup = await loadBackup(zipFile(buildBackupZip(await readSnapshot())));
    const before = await comparable();

    await deleteLog(dinner.id);
    await deleteRecipe(pepper.id); // unlinks the roast entry and bumps its updatedAt
    const result = await restoreBackup(backup, "merge");

    expect(result).toMatchObject({ recipesAdded: 1, recipesUpdated: 0, logsAdded: 1, logsUpdated: 1, photos: 1 });
    const after = await comparable();
    expect(after.recipes).toEqual(before.recipes);
    expect(after.photos).toEqual(before.photos);
    expect(await db.logs.get(dinner.id)).toEqual(before.logs.find((l) => l.id === dinner.id));
    expect((await db.logs.get(roast.id))?.recipeId).toBe(pepper.id);
    expect(await db.logs.count()).toBe(3);
  });

  it("keeps whichever copy has the newer updatedAt", async () => {
    const { biryani, pepper, lunch } = await seedData();
    const doc = buildBackupDocument(await readSnapshot(), { photos: "files" });

    // This device edits the biryani after the backup was made.
    await updateRecipe(biryani.id, { ...draftFromRecipe(biryani), title: "Biryani (edited here)" });
    // The backup holds a newer pepper roast and a newer lunch entry.
    const later = Date.now() + 60_000;
    doc.recipes = doc.recipes.map((r) => (r.id === pepper.id ? { ...r, title: "Pepper roast v2", updatedAt: later } : r));
    doc.logs = doc.logs.map((l) => (l.id === lunch.id ? { ...l, notes: "Extra chillies", updatedAt: later } : l));
    doc.photos = [];

    const result = await restoreBackup(await loadBackup(jsonFile(doc)), "merge");
    expect(result).toMatchObject({ recipesAdded: 0, recipesUpdated: 1, logsAdded: 0, logsUpdated: 1 });
    expect((await db.recipes.get(biryani.id))?.title).toBe("Biryani (edited here)");
    expect((await db.recipes.get(pepper.id))?.title).toBe("Pepper roast v2");
    expect((await db.logs.get(lunch.id))?.notes).toBe("Extra chillies");
    expect(await db.recipes.count()).toBe(2);
  });

  it("swaps a fresh install's untouched starter recipes for the backup's, relinking logs", async () => {
    // Old phone: starter recipes with a log entry against one of them.
    const oldSeeds = buildSeedRecipes(Date.now() - 86_400_000);
    await db.recipes.bulkAdd(oldSeeds);
    await createLog({ date: "2026-10-01", mealType: "dinner", recipeId: oldSeeds[0].id, dishName: oldSeeds[0].title, notes: "" });
    const backup = await loadBackup(zipFile(buildBackupZip(await readSnapshot())));

    // New phone: its own starter copies (new ids), one log against them.
    await clearAll();
    expect(await restoreStarterRecipes()).toBe(2);
    const localSeed = (await db.recipes.where("seedKey").equals(oldSeeds[0].seedKey ?? "").first())!;
    const localLog = await createLog({
      date: "2026-10-14",
      mealType: "lunch",
      recipeId: localSeed.id,
      dishName: localSeed.title,
      notes: "",
    });

    await restoreBackup(backup, "merge");
    const recipes = await db.recipes.toArray();
    expect(recipes).toHaveLength(2);
    expect(recipes.map((r) => r.id).sort()).toEqual(oldSeeds.map((r) => r.id).sort());
    expect((await db.logs.get(localLog.id))?.recipeId).toBe(oldSeeds[0].id);
    expect(await db.logs.count()).toBe(2);
  });
});

describe("restore sanitising", () => {
  const base = { format: "culinarylog-backup", version: 1, app: "CulinaryLog", exportedAt: "2026-10-16T16:10:00.000Z" };

  it("unlinks missing recipes, nulls dangling photos and drops unreadable records", async () => {
    const doc = {
      ...base,
      recipes: [
        { id: "r1", title: "  Chicken 65  ", ingredients: ["chicken", { text: "curry leaves", id: "i1" }], createdAt: 5, updatedAt: 6 },
        "not a recipe",
      ],
      logs: [
        { id: "l1", date: "2026-10-01", mealType: "dinner", recipeId: "gone", dishName: "Mutton curry", notes: "", photoId: "p-missing" },
        { id: "l2", date: "2026-10-02", mealType: "lunch", recipeId: "r1", photoId: "p2", createdAt: 10, updatedAt: 11 },
        { id: "l3", date: "not a date", mealType: "lunch", dishName: "Lost" },
        { date: "2026-10-03", mealType: "snack", dishName: "No id" },
      ],
      photos: [
        { id: "p2", logId: "l2", mime: "image/jpeg", width: 10, height: 10, createdAt: 1 },
        { id: "p3", logId: "nobody", data: "data:image/jpeg;base64,/9g=" },
      ],
      cookState: [{ recipeId: "r1", checkedIngredientIds: ["i1", "bogus"], doneStepIds: "nope", updatedAt: 3 }],
    };
    const backup = await loadBackup(jsonFile(doc));
    expect(backup.recipes).toHaveLength(1);
    expect(backup.logs.map((l) => l.id).sort()).toEqual(["l1", "l2"]);
    expect(backup.photos).toHaveLength(0);
    expect(backup.exportedAt).toBe(base.exportedAt);
    expect(backup.warnings.join(" ")).toMatch(/1 recipe .*skipped/);
    expect(backup.warnings.join(" ")).toMatch(/2 log entries .*skipped/);
    expect(backup.warnings.join(" ")).toMatch(/2 photos .*skipped/);

    const result = await restoreBackup(backup, "replace");
    expect(result).toMatchObject({ recipesAdded: 1, logsAdded: 2, photos: 0 });
    expect(result.skipped).toBe(5);

    const recipe = await db.recipes.get("r1");
    expect(recipe).toMatchObject({ title: "Chicken 65", createdAt: 5, updatedAt: 6 });
    expect(recipe?.ingredients.map((i) => i.text)).toEqual(["chicken", "curry leaves"]);
    expect(recipe?.ingredients[1].id).toBe("i1");

    const l1 = (await db.logs.get("l1")) as CookLog;
    expect(l1).toMatchObject({ recipeId: null, dishName: "Mutton curry", photoId: null });
    // Missing dish name falls back to the linked recipe's title.
    expect(await db.logs.get("l2")).toMatchObject({ recipeId: "r1", dishName: "Chicken 65", photoId: null, updatedAt: 11 });
    expect(await db.cookState.get("r1")).toEqual({ recipeId: "r1", checkedIngredientIds: ["i1"], doneStepIds: [], updatedAt: 3 });
  });

  it.each([
    ["an empty file", "", /empty/],
    ["text that isn't JSON", "hello, biryani", /isn't valid JSON/],
    ["JSON from something else", { name: "not ours" }, /isn't a CulinaryLog backup/],
    ["a backup from a newer version", { ...base, version: 2 }, /newer version of CulinaryLog/],
    ["a backup with no version", { ...base, version: "one" }, /version is missing or unreadable/],
  ])("rejects %s with a friendly message", async (_label, content, message) => {
    const error = await loadBackup(jsonFile(content)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackupError);
    expect((error as Error).message).toMatch(message);
  });

  it("rejects binary junk, damaged zips and zips without a backup inside", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const cases: Array<[Uint8Array, RegExp]> = [
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x80, 0x81, 0xfe]), /isn't a CulinaryLog backup/],
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]), /damaged or incomplete/],
      [zipSync({ "notes.json": strToU8("{}") }), /culinarylog-backup\.json is missing/],
    ];
    for (const [bytes, message] of cases) {
      const error = await loadBackup(new File([bytes.slice()], "x")).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BackupError);
      expect((error as Error).message).toMatch(message);
    }
  });

  it("leaves the database untouched when a file is rejected", async () => {
    await seedData();
    const before = await comparable();
    await expect(loadBackup(jsonFile({ ...base, version: 99 }))).rejects.toThrow(BackupError);
    expect(await comparable()).toEqual(before);
  });
});

describe("eraseAllData", () => {
  it("clears recipes, logs, photos and cooking progress", async () => {
    await seedData();
    await eraseAllData();
    expect(await comparable()).toEqual({ recipes: [], logs: [], cookState: [], photos: [] });
  });
});
