// Display helpers for the Settings screen: backup age, storage size, restore summary.

import { diffDays, formatAgo, toDateKey } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import type { BackupCounts, RestoreResult } from "./types";

/** Past this many days the "Last backup" line turns into a warning. */
export const BACKUP_STALE_DAYS = 14;

export interface LastBackupStatus {
  label: string;
  /** Never backed up, or longer ago than BACKUP_STALE_DAYS. */
  stale: boolean;
}

export function describeLastBackup(lastBackupAt: number | null, now: Date = new Date()): LastBackupStatus {
  if (lastBackupAt == null) return { label: "Never backed up", stale: true };
  const key = toDateKey(new Date(lastBackupAt));
  const days = diffDays(key, toDateKey(now));
  // A clock that moved backwards would say "upcoming"; treat it as today.
  return { label: `Last backup: ${days <= 0 ? "today" : formatAgo(key, now)}`, stale: days > BACKUP_STALE_DAYS };
}

/** Storage sizes in MB: 0 → "0 MB", 340 KB → "0.3 MB", 12.4 MB → "12 MB", 1.5 GB → "1.5 GB". */
export function formatMegabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return "< 0.1 MB";
  if (mb < 10) return `${Number(mb.toFixed(1))} MB`;
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${Number((mb / 1024).toFixed(1))} GB`;
}

/** "12 recipes, 40 log entries and 3 photos" (zero counts kept, so nothing reads as missing). */
export function formatCounts(counts: BackupCounts): string {
  const parts = [
    pluralize(counts.recipes, "recipe"),
    pluralize(counts.logs, "log entry", "log entries"),
    pluralize(counts.photos, "photo"),
  ];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** When a backup file was made: "14 Oct 2026, 21:30 · 3 days ago"; null when unknown. */
export function describeBackupDate(exportedAt: string | null, now: Date = new Date(), locale?: string): string | null {
  if (!exportedAt) return null;
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) return null;
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  const ago = formatAgo(toDateKey(date), now);
  return ago === "upcoming" ? when : `${when} · ${ago}`;
}

/** "2 recipes added · 12 log entries added · 3 photos", or a note that nothing changed. */
export function summarizeRestore(result: RestoreResult): string {
  const entries = (n: number) => pluralize(n, "log entry", "log entries");
  const parts = [
    result.recipesAdded > 0 && `${pluralize(result.recipesAdded, "recipe")} added`,
    result.recipesUpdated > 0 && `${pluralize(result.recipesUpdated, "recipe")} updated`,
    result.logsAdded > 0 && `${entries(result.logsAdded)} added`,
    result.logsUpdated > 0 && `${entries(result.logsUpdated)} updated`,
    result.photos > 0 && pluralize(result.photos, "photo"),
  ].filter((part): part is string => typeof part === "string");
  return parts.length > 0 ? parts.join(" · ") : "Everything was already up to date.";
}
