// Pure grouping and summary helpers for the cook log screens (calendar + timeline).

import { MEAL_ORDER } from "@/lib/db/logs";
import type { MonthRef } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import type { CookLog, MealType } from "@/lib/types";

export interface DayGroup {
  date: string;
  logs: CookLog[];
}

/** Within one day: breakfast → lunch → snack → dinner, then in the order they were logged. */
export function compareWithinDay(a: CookLog, b: CookLog): number {
  return MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType] || a.createdAt - b.createdAt;
}

/** Logs bucketed by date key; each day's list is meal-ordered. */
export function groupByDate(logs: readonly CookLog[]): Map<string, CookLog[]> {
  const days = new Map<string, CookLog[]>();
  for (const log of logs) {
    const list = days.get(log.date);
    if (list) list.push(log);
    else days.set(log.date, [log]);
  }
  for (const list of days.values()) list.sort(compareWithinDay);
  return days;
}

/** Days that have entries, newest day first, each day meal-ordered. */
export function groupByDayNewestFirst(logs: readonly CookLog[]): DayGroup[] {
  return [...groupByDate(logs)]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({ date, logs: list }));
}

export interface TimelinePage {
  days: DayGroup[];
  /** More (older) days exist beyond `dayLimit`. */
  hasMore: boolean;
}

/** The `dayLimit` most recent days that have entries. */
export function timelinePage(logs: readonly CookLog[], dayLimit: number): TimelinePage {
  const all = groupByDayNewestFirst(logs);
  const limit = Math.max(0, Math.floor(dayLimit));
  return { days: all.slice(0, limit), hasMore: all.length > limit };
}

export interface LogTotals {
  dishes: number;
  days: number;
}

/** Dish and distinct-day counts, optionally limited to start ≤ date ≤ end (inclusive keys). */
export function logTotals(logs: readonly CookLog[], start?: string, end?: string): LogTotals {
  const days = new Set<string>();
  let dishes = 0;
  for (const log of logs) {
    if ((start && log.date < start) || (end && log.date > end)) continue;
    dishes += 1;
    days.add(log.date);
  }
  return { dishes, days: days.size };
}

/** "14 dishes on 11 days", "1 dish on 1 day", "nothing logged". */
export function formatTotals(totals: LogTotals): string {
  if (totals.dishes === 0) return "nothing logged";
  return `${pluralize(totals.dishes, "dish", "dishes")} on ${pluralize(totals.days, "day")}`;
}

/** "October" (or "December 2025" when the year differs from `now`). */
export function formatMonthName(ref: MonthRef, now: Date = new Date(), locale?: string): string {
  return new Date(ref.year, ref.month, 1, 12).toLocaleDateString(
    locale,
    ref.year === now.getFullYear() ? { month: "long" } : { month: "long", year: "numeric" },
  );
}

/** "October · 14 dishes on 11 days". */
export function formatMonthSummary(ref: MonthRef, totals: LogTotals, now: Date = new Date(), locale?: string): string {
  return `${formatMonthName(ref, now, locale)} · ${formatTotals(totals)}`;
}

export interface DayDots {
  meals: MealType[];
  /** True when there were more dishes than dots. */
  more: boolean;
}

/** One dot per dish (in meal order) up to `max`; beyond that `max - 1` dots plus a "more" mark. */
export function dayDots(dayLogs: readonly CookLog[], max = 4): DayDots {
  if (dayLogs.length <= max) return { meals: dayLogs.map((l) => l.mealType), more: false };
  return { meals: dayLogs.slice(0, Math.max(0, max - 1)).map((l) => l.mealType), more: true };
}

export interface WeekdayLabel {
  short: string;
  long: string;
}

/** Calendar column headers starting on Sunday (0) or Monday (1). */
export function weekdayLabels(weekStartsOn: 0 | 1, locale?: string): WeekdayLabel[] {
  return Array.from({ length: 7 }, (_, i) => {
    // 1 January 2023 was a Sunday.
    const day = new Date(2023, 0, 1 + ((i + weekStartsOn) % 7), 12);
    return {
      short: day.toLocaleDateString(locale, { weekday: "short" }),
      long: day.toLocaleDateString(locale, { weekday: "long" }),
    };
  });
}

/** Whether a date key falls inside the given month. */
export function isInMonth(key: string, ref: MonthRef): boolean {
  return key.slice(0, 7) === `${ref.year}-${String(ref.month + 1).padStart(2, "0")}`;
}
