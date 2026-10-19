// Calendar helpers. Days are keyed by the LOCAL calendar date ("YYYY-MM-DD") and all
// arithmetic goes through local-noon Date objects, so DST shifts and the time of day
// can never move a key to the neighbouring day.

import type { MealType } from "./types";

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_KEY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local noon on the given day (noon keeps DST transitions from changing the date). */
export function fromDateKey(key: string): Date {
  const m = DATE_KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid date key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

export interface MonthRef {
  year: number;
  /** 0-based month, like Date#getMonth. */
  month: number;
}

export function monthOf(key: string): MonthRef {
  const d = fromDateKey(key);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function addMonths(ref: MonthRef, delta: number): MonthRef {
  const d = new Date(ref.year, ref.month + delta, 1, 12);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function firstDayOfMonth(ref: MonthRef): string {
  return toDateKey(new Date(ref.year, ref.month, 1, 12));
}

export function lastDayOfMonth(ref: MonthRef): string {
  return toDateKey(new Date(ref.year, ref.month + 1, 0, 12));
}

/**
 * 6×7 grid of date keys covering the month, padded with neighbouring days.
 * `weekStartsOn`: 0 = Sunday, 1 = Monday.
 */
export function monthGrid(ref: MonthRef, weekStartsOn: 0 | 1 = 1): string[][] {
  const first = new Date(ref.year, ref.month, 1, 12);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = toDateKey(new Date(ref.year, ref.month, 1 - offset, 12));
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) week.push(addDays(start, w * 7 + d));
    weeks.push(week);
  }
  return weeks;
}

export function formatMonth(ref: MonthRef, locale?: string): string {
  return new Date(ref.year, ref.month, 1, 12).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

/** "Today", "Yesterday", "Tomorrow", else e.g. "Mon, 12 Oct" (adds the year when it differs). */
export function formatDayLabel(key: string, now: Date = new Date(), locale?: string): string {
  const today = toDateKey(now);
  const delta = diffDays(today, key);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta === 1) return "Tomorrow";
  const d = fromDateKey(key);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "3 days ago", "2 weeks ago", "today" — coarse, for card metadata. */
export function formatAgo(key: string, now: Date = new Date()): string {
  const days = diffDays(key, toDateKey(now));
  if (days <= 0) return days === 0 ? "today" : "upcoming";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "1 week ago" : `${w} weeks ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return m === 1 ? "1 month ago" : `${m} months ago`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? "1 year ago" : `${y} years ago`;
}

/** Sensible default meal tag for "now": breakfast < 11:00 ≤ lunch < 16:00 ≤ snack < 18:30 ≤ dinner. */
export function defaultMealForTime(now: Date = new Date()): MealType {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 4 * 60 && minutes < 11 * 60) return "breakfast";
  if (minutes >= 11 * 60 && minutes < 16 * 60) return "lunch";
  if (minutes >= 16 * 60 && minutes < 18 * 60 + 30) return "snack";
  return "dinner";
}
