// Human-readable exports: the cook log as a Markdown diary, recipe files with unique
// names, the all-in-one Markdown export and the README that ships inside the .zip.

import { compareLogsNewestFirst } from "@/lib/db";
import { fromDateKey } from "@/lib/dates";
import { pluralize, slugify } from "@/lib/format";
import { recipeToMarkdown } from "@/lib/markdown/recipeMarkdown";
import { MEAL_LABELS, type CookLog, type Recipe } from "@/lib/types";
import { BACKUP_JSON_NAME, type BackupDocument, type DataSnapshot } from "./types";

// Fixed English names (not toLocaleDateString) so exported files read the same on every device.
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-10-16" → "Friday, 16 October 2026". */
export function formatLongDate(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-10-16" → "October 2026". */
function formatMonthHeading(key: string): string {
  const d = fromDateKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "16 October 2026 at 21:40" in local time. */
export function formatExportTime(date: Date): string {
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} at ${time}`;
}

/** Recipes A–Z by title. */
export function sortRecipesByTitle(recipes: readonly Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/** Unique "recipes/<slug>.md" path per recipe id; clashing titles get "-2", "-3", … */
export function recipeFilePaths(recipes: readonly Recipe[]): Map<string, string> {
  const used = new Set<string>();
  const paths = new Map<string, string>();
  for (const recipe of sortRecipesByTitle(recipes)) {
    const base = slugify(recipe.title);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    paths.set(recipe.id, `recipes/${slug}.md`);
  }
  return paths;
}

/** "- **Dinner** · Dish — first line of notes", further note lines and the photo link as continuation lines. */
function logEntry(log: CookLog, photoPath: string | undefined): string[] {
  // Blank lines would end the list item, so the notes' empty lines are dropped.
  const [first, ...rest] = log.notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = [`- **${MEAL_LABELS[log.mealType]}** · ${log.dishName}${first ? ` — ${first}` : ""}`];
  lines.push(...rest.map((line) => `  ${line}`));
  if (photoPath) lines.push(`  [Photo](${photoPath})`);
  return lines;
}

export interface CookLogMarkdownOptions {
  /** photoId → relative path; entries with a known path get a photo link. */
  photoPaths?: ReadonlyMap<string, string>;
}

/** The cook log as a diary: months, then days, newest first. */
export function cookLogToMarkdown(logs: readonly CookLog[], options: CookLogMarkdownOptions = {}): string {
  const lines = ["# Cook log", ""];
  if (logs.length === 0) {
    lines.push("No dishes logged yet.", "");
    return lines.join("\n");
  }
  const sorted = [...logs].sort(compareLogsNewestFirst);
  lines.push(`${pluralize(sorted.length, "dish", "dishes")} logged, newest first.`, "");

  let month = "";
  let day = "";
  for (const log of sorted) {
    if (log.date.slice(0, 7) !== month) {
      month = log.date.slice(0, 7);
      if (day) lines.push("");
      lines.push(`## ${formatMonthHeading(log.date)}`);
      day = "";
    }
    if (log.date !== day) {
      day = log.date;
      lines.push("", `### ${formatLongDate(log.date)}`, "");
    }
    const photoPath = log.photoId ? options.photoPaths?.get(log.photoId) : undefined;
    lines.push(...logEntry(log, photoPath));
  }
  lines.push("");
  return lines.join("\n");
}

/** One Markdown file: every recipe (A–Z, separated by ---), then the cook log. */
export function buildMarkdownExport(snapshot: Pick<DataSnapshot, "recipes" | "logs">, now: Date = new Date()): string {
  const header = [
    "# CulinaryLog export",
    "",
    `Exported ${formatExportTime(now)} · ${pluralize(snapshot.recipes.length, "recipe")} · ` +
      `${pluralize(snapshot.logs.length, "cook log entry", "cook log entries")}`,
  ].join("\n");
  const recipes = sortRecipesByTitle(snapshot.recipes).map((r) => recipeToMarkdown(r).trim());
  // Blank lines around --- so it is a thematic break, never a setext heading underline.
  return [header, ...recipes, cookLogToMarkdown(snapshot.logs).trim()].join("\n\n---\n\n") + "\n";
}

/** README.txt inside the .zip. */
export function backupReadme(doc: BackupDocument, now: Date = new Date()): string {
  const { recipes, logs, photos } = doc.counts;
  return [
    "CulinaryLog backup",
    "==================",
    "",
    `Exported:    ${formatExportTime(now)}`,
    `App version: ${doc.appVersion}`,
    `Contains:    ${pluralize(recipes, "recipe")}, ${pluralize(logs, "cook log entry", "cook log entries")}, ` +
      `${pluralize(photos, "photo")}`,
    "",
    "What's inside",
    "-------------",
    `${BACKUP_JSON_NAME.padEnd(25)} Everything (recipes, cook log, cooking progress). The app restores from this file.`,
    `${"photos/".padEnd(25)} Plate photos (full size and thumbnails), referenced by the JSON.`,
    `${"recipes/".padEnd(25)} One Markdown file per recipe. Readable anywhere; paste one into Import to add it back.`,
    `${"cook-log.md".padEnd(25)} Your cook log as a diary, newest first.`,
    "",
    "How to restore",
    "--------------",
    "1. Open CulinaryLog and go to Settings > Restore from backup.",
    "2. Pick this .zip file. There's no need to unzip it.",
    '3. Choose "Merge" to add what this device is missing, or "Replace all" to make the app match this backup exactly.',
    "",
    "CulinaryLog keeps your data only on your device. Store this file somewhere safe,",
    "such as Files, iCloud Drive or Google Drive.",
    "",
  ].join("\n");
}
