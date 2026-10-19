import { describe, expect, it } from "vitest";
import type { CookLog, MealType } from "@/lib/types";
import {
  dayDots,
  formatMonthSummary,
  formatTotals,
  groupByDate,
  groupByDayNewestFirst,
  isInMonth,
  logTotals,
  timelinePage,
  weekdayLabels,
} from "./group";

let seq = 0;
function log(date: string, mealType: MealType, createdAt = ++seq): CookLog {
  return {
    id: `log-${seq}-${date}-${mealType}`,
    date,
    mealType,
    recipeId: null,
    dishName: `${mealType} on ${date}`,
    notes: "",
    photoId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("groupByDate", () => {
  it("buckets by day and orders breakfast → lunch → snack → dinner, then by creation", () => {
    const logs = [
      log("2026-10-12", "dinner", 50),
      log("2026-10-12", "breakfast", 40),
      log("2026-10-13", "lunch", 30),
      log("2026-10-12", "snack", 20),
      log("2026-10-12", "dinner", 10),
    ];
    const days = groupByDate(logs);
    expect([...days.keys()].sort()).toEqual(["2026-10-12", "2026-10-13"]);
    expect(days.get("2026-10-12")?.map((l) => [l.mealType, l.createdAt])).toEqual([
      ["breakfast", 40],
      ["snack", 20],
      ["dinner", 10],
      ["dinner", 50],
    ]);
  });

  it("does not mutate the input", () => {
    const logs = [log("2026-10-12", "dinner"), log("2026-10-12", "breakfast")];
    const copy = [...logs];
    groupByDate(logs);
    expect(logs).toEqual(copy);
  });
});

describe("groupByDayNewestFirst / timelinePage", () => {
  const logs = [
    log("2026-09-30", "dinner"),
    log("2026-10-12", "lunch"),
    log("2026-10-02", "dinner"),
    log("2026-10-12", "breakfast"),
    log("2025-12-31", "snack"),
  ];

  it("orders days newest first", () => {
    expect(groupByDayNewestFirst(logs).map((d) => d.date)).toEqual([
      "2026-10-12",
      "2026-10-02",
      "2026-09-30",
      "2025-12-31",
    ]);
    expect(groupByDayNewestFirst(logs)[0].logs.map((l) => l.mealType)).toEqual(["breakfast", "lunch"]);
  });

  it("pages by days that have entries", () => {
    expect(timelinePage(logs, 2)).toMatchObject({ hasMore: true });
    expect(timelinePage(logs, 2).days.map((d) => d.date)).toEqual(["2026-10-12", "2026-10-02"]);
    expect(timelinePage(logs, 4).hasMore).toBe(false);
    expect(timelinePage(logs, 30).days).toHaveLength(4);
    expect(timelinePage([], 30)).toEqual({ days: [], hasMore: false });
  });
});

describe("logTotals / summaries", () => {
  const logs = [
    log("2026-10-01", "breakfast"),
    log("2026-10-01", "dinner"),
    log("2026-10-17", "dinner"),
    log("2026-09-30", "dinner"),
    log("2026-11-01", "lunch"),
  ];

  it("counts dishes and distinct days within an inclusive range", () => {
    expect(logTotals(logs, "2026-10-01", "2026-10-31")).toEqual({ dishes: 3, days: 2 });
    expect(logTotals(logs)).toEqual({ dishes: 5, days: 4 });
    expect(logTotals([], "2026-10-01", "2026-10-31")).toEqual({ dishes: 0, days: 0 });
  });

  it("formats totals with correct plurals", () => {
    expect(formatTotals({ dishes: 14, days: 11 })).toBe("14 dishes on 11 days");
    expect(formatTotals({ dishes: 1, days: 1 })).toBe("1 dish on 1 day");
    expect(formatTotals({ dishes: 0, days: 0 })).toBe("nothing logged");
  });

  it("formats the month subtitle, adding the year only for other years", () => {
    const now = new Date(2026, 9, 17, 12);
    expect(formatMonthSummary({ year: 2026, month: 9 }, { dishes: 14, days: 11 }, now, "en-GB")).toBe(
      "October · 14 dishes on 11 days",
    );
    expect(formatMonthSummary({ year: 2025, month: 11 }, { dishes: 0, days: 0 }, now, "en-GB")).toBe(
      "December 2025 · nothing logged",
    );
  });
});

describe("dayDots", () => {
  it("shows one dot per dish up to the max", () => {
    const day = [log("2026-10-01", "breakfast"), log("2026-10-01", "lunch"), log("2026-10-01", "dinner")];
    expect(dayDots(day)).toEqual({ meals: ["breakfast", "lunch", "dinner"], more: false });
    expect(dayDots([])).toEqual({ meals: [], more: false });
  });

  it("collapses the overflow into a more marker", () => {
    const day = (["breakfast", "lunch", "snack", "dinner", "dinner"] as const).map((m) => log("2026-10-01", m));
    expect(dayDots(day)).toEqual({ meals: ["breakfast", "lunch", "snack"], more: true });
    expect(dayDots(day.slice(0, 4))).toEqual({ meals: ["breakfast", "lunch", "snack", "dinner"], more: false });
  });
});

describe("weekdayLabels / isInMonth", () => {
  it("starts on Monday or Sunday", () => {
    expect(weekdayLabels(1, "en-GB").map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(weekdayLabels(0, "en-GB").map((d) => d.long)[0]).toBe("Sunday");
  });

  it("checks month membership by key", () => {
    expect(isInMonth("2026-10-31", { year: 2026, month: 9 })).toBe(true);
    expect(isInMonth("2026-11-01", { year: 2026, month: 9 })).toBe(false);
    expect(isInMonth("2026-01-05", { year: 2026, month: 0 })).toBe(true);
  });
});
