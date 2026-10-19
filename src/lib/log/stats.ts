// Per-recipe cook statistics for the recipe page's cook history and the dish picker.

import { formatAgo, fromDateKey } from "@/lib/dates";
import type { CookLog } from "@/lib/types";

export interface CookSummary {
  count: number;
  firstDate: string | null;
  lastDate: string | null;
}

export function cookSummary(logs: readonly CookLog[]): CookSummary {
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  for (const log of logs) {
    if (firstDate === null || log.date < firstDate) firstDate = log.date;
    if (lastDate === null || log.date > lastDate) lastDate = log.date;
  }
  return { count: logs.length, firstDate, lastDate };
}

/** "2 Mar" (or "2 Mar 2025" when the year differs from `now`). */
export function formatShortDate(key: string, now: Date = new Date(), locale?: string): string {
  const date = fromDateKey(key);
  return date.toLocaleDateString(
    locale,
    date.getFullYear() === now.getFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
}

/** "Cooked 5 times · first 2 Mar · last 3 days ago", "Cooked once · yesterday", "Not cooked yet". */
export function formatCookSummary(summary: CookSummary, now: Date = new Date(), locale?: string): string {
  const { count, firstDate, lastDate } = summary;
  if (count === 0 || !firstDate || !lastDate) return "Not cooked yet";
  const ago = formatAgo(lastDate, now);
  const when = ago === "upcoming" ? formatShortDate(lastDate, now, locale) : ago;
  if (count === 1) return `Cooked once · ${when}`;
  // "last 3 days ago" reads well; "last today" doesn't.
  const last = ago.endsWith("ago") || ago === "upcoming" ? `last ${when}` : `last cooked ${when}`;
  return `Cooked ${count} times · first ${formatShortDate(firstDate, now, locale)} · ${last}`;
}

/** Distinct recipe ids, most recently cooked first (custom dishes are skipped). */
export function recentRecipeIds(logs: readonly CookLog[], limit: number): string[] {
  const newestFirst = [...logs].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt - a.createdAt,
  );
  const ids: string[] = [];
  for (const log of newestFirst) {
    if (ids.length >= limit) break;
    if (log.recipeId && !ids.includes(log.recipeId)) ids.push(log.recipeId);
  }
  return ids;
}
