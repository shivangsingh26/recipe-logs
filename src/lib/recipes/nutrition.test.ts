import { describe, expect, it } from "vitest";
import { EMPTY_MACROS } from "@/lib/types";
import { calorieShare, caloriesFromMacros, hasAnyMacro } from "./nutrition";
import { groupIntoSections } from "./sections";

describe("nutrition", () => {
  const biryani = { calories: 770, protein: 46, carbs: 94, fat: 23 };

  it("detects whether anything is known", () => {
    expect(hasAnyMacro(EMPTY_MACROS)).toBe(false);
    expect(hasAnyMacro({ ...EMPTY_MACROS, fat: 0 })).toBe(true);
  });

  it("estimates calories only when protein, carbs and fat are all known", () => {
    expect(caloriesFromMacros(biryani)).toBe(767);
    expect(caloriesFromMacros({ ...biryani, fat: null })).toBeNull();
    expect(caloriesFromMacros({ calories: null, protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });

  it("splits energy by macro", () => {
    const share = calorieShare(biryani);
    expect(share).not.toBeNull();
    expect(Math.round((share?.protein ?? 0) * 100)).toBe(24);
    expect(Math.round((share?.carbs ?? 0) * 100)).toBe(49);
    expect(Math.round((share?.fat ?? 0) * 100)).toBe(27);
    expect(calorieShare({ ...biryani, carbs: null })).toBeNull();
  });
});

describe("groupIntoSections", () => {
  it("groups consecutive items, keeping order and absolute indexes", () => {
    const sections = groupIntoSections([{ text: "a" }, { text: "b", group: "G" }, { text: "c", group: "G" }, { text: "d" }]);
    expect(sections.map((s) => [s.group, s.entries.map((e) => e.index)])).toEqual([
      [null, [0]],
      ["G", [1, 2]],
      [null, [3]],
    ]);
  });
});
