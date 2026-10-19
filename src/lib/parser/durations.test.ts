import { describe, expect, it } from "vitest";
import { SEED_RECIPES } from "@/lib/seeds";
import { findDurations, parseCount, parseDurationMinutes } from "./durations";

const one = (text: string) => findDurations(text).map((d) => [d.label, d.seconds]);

describe("findDurations", () => {
  it.each([
    ["Air fry for 14 min, shaking", "14 min", 840],
    ["cook 14 mins", "14 mins", 840],
    ["simmer for 14 minutes", "14 minutes", 840],
    ["a 14-minute boil", "14-minute", 840],
    ["marinate 2 hours", "2 hours", 7200],
    ["marinate 2 hrs", "2 hrs", 7200],
    ["bake 1 hr 30 min", "1 hr 30 min", 5400],
    ["rest 1 hour and 30 minutes", "1 hour and 30 minutes", 5400],
    ["slow cook 1h30m", "1h30m", 5400],
    ["slow cook 1h 30m", "1h 30m", 5400],
    ["blend 90 sec", "90 sec", 90],
    ["stir 30 seconds", "30 seconds", 30],
    ["stir 30 sec", "30 sec", 30],
    ["braise 1½ hours", "1½ hours", 5400],
    ["braise 1 ½ hours", "1 ½ hours", 5400],
    ["braise 1.5 hours", "1.5 hours", 5400],
    ["chill ½ hour", "½ hour", 1800],
    ["chill for half an hour", "half an hour", 1800],
    ["prove for an hour", "an hour", 3600],
    ["stir for a minute", "a minute", 60],
    ["boil 5–6 min", "5–6 min", 300],
    ["boil 5-6 minutes", "5-6 minutes", 300],
    ["boil 5 to 6 minutes", "5 to 6 minutes", 300],
    ["roast for an hour and a half", "an hour and a half", 5400],
    ["pressure cook 1 h 15 min", "1 h 15 min", 4500],
    ["rest 2 minutes 30 seconds", "2 minutes 30 seconds", 150],
    ["cook 1m30s", "1m30s", 90],
  ])("%s → %s", (text, label, seconds) => {
    expect(one(text)).toEqual([[label, seconds]]);
  });

  it.each([
    "Air fry at 160°C until golden",
    "Bake at 200 F",
    "Grease the 5 L cooker",
    "Bring 2.5 L water to a boil",
    "Add 3 tbsp water",
    "Add 2–3 tbsp water",
    "Use a 5L cooker",
    "1-inch cinnamon stick",
    "Cook for 4 whistles",
    "Dinner at 5 pm",
    "Recipe from 2024",
    "Refrigerate overnight",
    "Fry a second batch",
    "Cut into 10 m strips",
    "Toast 5 minced cloves",
    "In the 90s",
  ])("ignores %s", (text) => {
    expect(findDurations(text)).toEqual([]);
  });

  it("returns non-overlapping matches in order with exact offsets", () => {
    const text = "Sear for 5 min, then cover and cook 12–15 minutes; rest 1 hr 10 min.";
    const matches = findDurations(text);
    expect(matches.map((m) => m.label)).toEqual(["5 min", "12–15 minutes", "1 hr 10 min"]);
    for (const m of matches) expect(text.slice(m.start, m.end)).toBe(m.label);
    expect(matches.map((m) => m.seconds)).toEqual([300, 720, 4200]);
  });

  it("finds every timer in the biryani seed steps", () => {
    const steps = SEED_RECIPES[0].steps.map((s) => s.text);
    const found = steps.flatMap((s) => findDurations(s).map((d) => [d.label, d.seconds]));
    expect(found).toEqual([
      ["14 min", 840],
      ["2 hours", 7200],
      ["30 min", 1800],
      ["5–6 min", 300],
      ["7 min", 420],
      ["25 min", 1500],
      ["10 min", 600],
    ]);
    const labels = found.map(([label]) => label);
    for (const nonTimer of ["160°C", "2.5 L", "3 tbsp", "5 L"]) expect(labels).not.toContain(nonTimer);
  });

  it("finds every timer in the pepper chicken seed steps", () => {
    const steps = SEED_RECIPES[1].steps.map((s) => s.text);
    const found = steps.flatMap((s) => findDurations(s).map((d) => [d.label, d.seconds]));
    expect(found).toEqual([
      ["30 min", 1800],
      ["2 min", 120],
      ["8 min", 480],
      ["1 min", 60],
      ["30 sec", 30],
      ["5 min", 300],
      ["12 min", 720],
      ["10 min", 600],
      ["4 min", 240],
    ]);
  });
});

describe("parseDurationMinutes", () => {
  it.each([
    ["20 mins", 20],
    ["1 hr 15 min", 75],
    ["1h15m", 75],
    ["1.5 hours", 90],
    ["90 minutes", 90],
    ["an hour", 60],
    ["½ hour", 30],
    ["30-40 min", 30],
    ["45", 45],
  ])("%s → %d", (text, minutes) => {
    expect(parseDurationMinutes(text)).toBe(minutes);
  });

  it("returns null for non-durations", () => {
    expect(parseDurationMinutes("until golden")).toBeNull();
  });
});

describe("parseCount", () => {
  it("reads leading counts", () => {
    expect(parseCount("4–6")).toBe(4);
    expect(parseCount("four")).toBe(4);
    expect(parseCount("2.5 cups")).toBe(2.5);
    expect(parseCount("a few")).toBeNull();
  });
});
