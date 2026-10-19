import { describe, expect, it } from "vitest";
import type { CookLog } from "@/lib/types";
import { cookSummary, formatCookSummary, formatShortDate, recentRecipeIds } from "./stats";

let seq = 0;
function log(date: string, recipeId: string | null, createdAt = ++seq): CookLog {
  return {
    id: `log-${seq}`,
    date,
    mealType: "dinner",
    recipeId,
    dishName: recipeId ?? "Custom",
    notes: "",
    photoId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

const NOW = new Date(2026, 9, 17, 18, 30);

describe("cookSummary", () => {
  it("counts cooks and finds the first and last dates", () => {
    const logs = [log("2026-10-14", "a"), log("2026-03-02", "a"), log("2026-08-01", "a")];
    expect(cookSummary(logs)).toEqual({ count: 3, firstDate: "2026-03-02", lastDate: "2026-10-14" });
    expect(cookSummary([])).toEqual({ count: 0, firstDate: null, lastDate: null });
  });
});

describe("formatCookSummary", () => {
  it("summarises many cooks", () => {
    const s = { count: 5, firstDate: "2026-03-02", lastDate: "2026-10-14" };
    expect(formatCookSummary(s, NOW, "en-GB")).toBe("Cooked 5 times · first 2 Mar · last 3 days ago");
  });

  it("reads naturally for today, yesterday and single cooks", () => {
    expect(formatCookSummary({ count: 2, firstDate: "2026-10-01", lastDate: "2026-10-17" }, NOW, "en-GB")).toBe(
      "Cooked 2 times · first 1 Oct · last cooked today",
    );
    expect(formatCookSummary({ count: 1, firstDate: "2026-10-16", lastDate: "2026-10-16" }, NOW, "en-GB")).toBe(
      "Cooked once · yesterday",
    );
    expect(formatCookSummary({ count: 0, firstDate: null, lastDate: null }, NOW)).toBe("Not cooked yet");
  });

  it("adds the year to dates from other years", () => {
    const s = { count: 3, firstDate: "2025-12-24", lastDate: "2026-09-17" };
    expect(formatCookSummary(s, NOW, "en-GB")).toBe("Cooked 3 times · first 24 Dec 2025 · last 1 month ago");
    expect(formatShortDate("2026-03-02", NOW, "en-GB")).toBe("2 Mar");
  });
});

describe("recentRecipeIds", () => {
  it("returns distinct recipes, most recently cooked first, skipping custom dishes", () => {
    const logs = [
      log("2026-10-10", "biryani", 1),
      log("2026-10-16", null, 2),
      log("2026-10-15", "pepper", 3),
      log("2026-10-15", "dal", 4),
      log("2026-10-01", "pepper", 5),
      log("2026-09-01", "poha", 6),
    ];
    expect(recentRecipeIds(logs, 10)).toEqual(["dal", "pepper", "biryani", "poha"]);
    expect(recentRecipeIds(logs, 2)).toEqual(["dal", "pepper"]);
    expect(recentRecipeIds([], 4)).toEqual([]);
  });
});
