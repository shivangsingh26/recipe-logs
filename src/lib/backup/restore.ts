// Restore: read a .zip or .json backup, validate and sanitise it (loadBackup), then write
// it into IndexedDB in a single transaction (restoreBackup).

import { unzipSync, type Unzipped } from "fflate";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import type { CookLog, CookState, Photo, Recipe } from "@/lib/types";
import { fromDataUrl, isZip, toArrayBuffer } from "./encoding";
import { cleanId, isRecord, sanitizeCookState, sanitizeLog, sanitizePhotoMeta, sanitizeRecipe } from "./sanitize";
import {
  BACKUP_FORMAT,
  BACKUP_JSON_NAME,
  BACKUP_VERSION,
  type BackupCounts,
  type LoadedBackup,
  type RestoreMode,
  type RestoreResult,
} from "./types";

/** A problem with the backup file itself. `message` is written for the person restoring. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

const NOT_A_BACKUP = "This file isn't a CulinaryLog backup. Choose a .zip or .json file exported from Settings.";

type Loose = Record<string, unknown>;
type FileLookup = (path: unknown) => Uint8Array | undefined;

function parseJson(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BackupError(NOT_A_BACKUP);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new BackupError("This file isn't valid JSON, so it can't be restored. It may be incomplete or damaged.");
  }
}

function checkHeader(data: unknown): Loose {
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) throw new BackupError(NOT_A_BACKUP);
  const { version } = data;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new BackupError("This backup's format version is missing or unreadable, so it can't be restored.");
  }
  if (version > BACKUP_VERSION) {
    throw new BackupError(
      `This backup was made by a newer version of CulinaryLog (format v${version}). Update the app, then try again.`,
    );
  }
  return data;
}

const PHOTO_FILE_RE = /\.(jpe?g|png|webp|gif|avif|heic)$/i;

function isJunkPath(name: string): boolean {
  return name.startsWith("__MACOSX/") || name.split("/").some((part) => part.startsWith("._"));
}

/** Unzips only what a restore needs: the JSON document and image files. */
function readZip(bytes: Uint8Array): { data: Loose; lookup: FileLookup } {
  let entries: Unzipped;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => !isJunkPath(file.name) && (file.name.endsWith(".json") || PHOTO_FILE_RE.test(file.name)),
    });
  } catch {
    throw new BackupError("This .zip file is damaged or incomplete, so it can't be restored.");
  }
  // The JSON sits at the root of our archives; accept it one folder down too (re-zipped by hand).
  const jsonPath = Object.keys(entries)
    .filter((name) => name === BACKUP_JSON_NAME || name.endsWith(`/${BACKUP_JSON_NAME}`))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!jsonPath) {
    throw new BackupError(`This .zip doesn't contain a CulinaryLog backup (${BACKUP_JSON_NAME} is missing).`);
  }
  const dir = jsonPath.slice(0, jsonPath.length - BACKUP_JSON_NAME.length);
  const lookup: FileLookup = (path) =>
    typeof path === "string" && path ? entries[dir + path.replace(/^(\.\/|\/)+/, "")] : undefined;
  return { data: checkHeader(parseJson(entries[jsonPath])), lookup };
}

/** Full-size and thumbnail bytes from zip files or data URLs; either one stands in for a missing other. */
function photoBytes(raw: Loose, lookup: FileLookup): { data: Uint8Array; thumb: Uint8Array } | null {
  const data = lookup(raw.file) ?? fromDataUrl(raw.data)?.bytes;
  const thumb = lookup(raw.thumbFile) ?? fromDataUrl(raw.thumb)?.bytes;
  const full = data ?? thumb;
  return full ? { data: full, thumb: thumb ?? full } : null;
}

function newestById<T extends { id: string; updatedAt: number }>(items: Iterable<T>): Map<string, T> {
  const byId = new Map<string, T>();
  for (const item of items) {
    const previous = byId.get(item.id);
    if (!previous || item.updatedAt > previous.updatedAt) byId.set(item.id, item);
  }
  return byId;
}

function sanitizeBackup(data: Loose, source: LoadedBackup["source"], lookup: FileLookup): LoadedBackup {
  const now = Date.now();
  const warnings: string[] = [];
  const section = (key: string): unknown[] => {
    const value = data[key];
    if (value === undefined) return [];
    if (Array.isArray(value)) return value;
    warnings.push(`The ${key} section of this file was unreadable and was skipped.`);
    return [];
  };
  const dropped = (count: number, singular: string, plural: string) => {
    if (count > 0) {
      warnings.push(`${pluralize(count, singular, plural)} couldn't be read and ${count === 1 ? "was" : "were"} skipped.`);
    }
    return count;
  };

  const rawRecipes = section("recipes");
  const recipes = newestById(
    rawRecipes.map((raw) => sanitizeRecipe(raw, now)).filter((r): r is Recipe => r !== null),
  );

  const rawLogs = section("logs");
  const titleOf = (id: string) => recipes.get(id)?.title;
  const logs = newestById(rawLogs.map((raw) => sanitizeLog(raw, now, titleOf)).filter((l): l is CookLog => l !== null));

  // A photo needs bytes and a log entry in this backup that points back at it.
  const rawPhotos = section("photos");
  const photos = new Map<string, Photo>();
  for (const raw of rawPhotos) {
    const meta = sanitizePhotoMeta(raw, now);
    if (!meta || !isRecord(raw) || logs.get(meta.logId)?.photoId !== meta.id) continue;
    const bytes = photoBytes(raw, lookup);
    if (bytes) photos.set(meta.id, { ...meta, data: toArrayBuffer(bytes.data), thumb: toArrayBuffer(bytes.thumb) });
  }

  const cookState = new Map<string, CookState>();
  for (const raw of section("cookState")) {
    const recipe = isRecord(raw) ? recipes.get(cleanId(raw.recipeId) ?? "") : undefined;
    if (recipe) cookState.set(recipe.id, sanitizeCookState(raw, recipe));
  }

  const droppedCount =
    dropped(rawRecipes.length - recipes.size, "recipe", "recipes") +
    dropped(rawLogs.length - logs.size, "log entry", "log entries") +
    dropped(rawPhotos.length - photos.size, "photo", "photos");

  return {
    source,
    exportedAt: typeof data.exportedAt === "string" && !Number.isNaN(Date.parse(data.exportedAt)) ? data.exportedAt : null,
    appVersion: typeof data.appVersion === "string" && data.appVersion.trim() ? data.appVersion.trim().slice(0, 40) : null,
    recipes: [...recipes.values()],
    logs: [...logs.values()],
    cookState: [...cookState.values()],
    photos: [...photos.values()],
    missingPhotos: [...logs.values()].filter((l) => l.photoId && !photos.has(l.photoId)).length,
    dropped: droppedCount,
    warnings,
  };
}

/**
 * Reads a backup file (.zip or .json, detected from its bytes) and sanitises every record.
 * Nothing is written yet. Throws BackupError with a friendly message for unusable files.
 */
export async function loadBackup(file: Blob): Promise<LoadedBackup> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) throw new BackupError("This file is empty.");
  if (isZip(bytes)) {
    const { data, lookup } = readZip(bytes);
    return sanitizeBackup(data, "zip", lookup);
  }
  return sanitizeBackup(checkHeader(parseJson(bytes)), "json", () => undefined);
}

export function backupCounts(backup: Pick<LoadedBackup, "recipes" | "logs" | "photos">): BackupCounts {
  return { recipes: backup.recipes.length, logs: backup.logs.length, photos: backup.photos.length };
}

// ── Writing ───────────────────────────────────────────────────────────────────

const userTables = () => [db.recipes, db.logs, db.photos, db.cookState];

async function clearUserTables(): Promise<void> {
  await db.recipes.clear();
  await db.logs.clear();
  await db.photos.clear();
  await db.cookState.clear();
}

/** Deletes every recipe, log entry, photo and cooking progress on this device. */
export async function eraseAllData(): Promise<void> {
  await db.transaction("rw", userTables(), clearUserTables);
}

/**
 * A fresh install seeds its own copies of the starter recipes (new ids). When the backup
 * brings its copies, drop the local ones that were never edited, relinking their log
 * entries, so a merge doesn't leave two of each starter recipe.
 */
async function replaceUntouchedStarters(incoming: readonly Recipe[]): Promise<void> {
  const bySeed = new Map(incoming.filter((r) => r.seedKey).map((r) => [r.seedKey as string, r]));
  if (bySeed.size === 0) return;
  const locals = await db.recipes.where("seedKey").anyOf([...bySeed.keys()]).toArray();
  for (const local of locals) {
    const replacement = bySeed.get(local.seedKey as string);
    if (!replacement || replacement.id === local.id || local.updatedAt !== local.createdAt) continue;
    await db.logs.where("recipeId").equals(local.id).modify({ recipeId: replacement.id });
    await db.cookState.delete(local.id);
    await db.recipes.delete(local.id);
  }
}

async function writeRecipes(incoming: readonly Recipe[], result: RestoreResult): Promise<void> {
  const existing = await db.recipes.bulkGet(incoming.map((r) => r.id));
  const writes: Recipe[] = [];
  incoming.forEach((recipe, i) => {
    const local = existing[i];
    if (!local) result.recipesAdded += 1;
    else if (recipe.updatedAt > local.updatedAt) result.recipesUpdated += 1;
    else {
      result.skipped += 1;
      return;
    }
    writes.push(recipe);
  });
  await db.recipes.bulkPut(writes);
}

/** Writes log entries; returns the photo id each backup log ends up with (written or kept). */
async function writeLogs(backup: LoadedBackup, mode: RestoreMode, result: RestoreResult): Promise<Map<string, string | null>> {
  const recipeIds = new Set(await db.recipes.toCollection().primaryKeys());
  const available = new Set<string>(backup.photos.map((p) => p.id));
  if (mode === "merge") (await db.photos.toCollection().primaryKeys()).forEach((id) => available.add(id));

  const existing = await db.logs.bulkGet(backup.logs.map((l) => l.id));
  const finalPhotoIds = new Map<string, string | null>();
  const writes: CookLog[] = [];
  const orphanedPhotoIds: string[] = [];
  backup.logs.forEach((log, i) => {
    const local = existing[i];
    if (local && local.updatedAt >= log.updatedAt) {
      finalPhotoIds.set(log.id, local.photoId);
      // Deleting a recipe unlinks its entries (bumping updatedAt). When the backup brings the
      // recipe back, relink them and leave everything else about this device's copy alone.
      if (!local.recipeId && log.recipeId && recipeIds.has(log.recipeId) && local.dishName === log.dishName) {
        writes.push({ ...local, recipeId: log.recipeId });
        result.logsUpdated += 1;
      } else {
        result.skipped += 1;
      }
      return;
    }
    // The backup says there is a photo but doesn't carry it (e.g. JSON without photos): keep ours.
    const photoId = log.photoId && !available.has(log.photoId) ? (local?.photoId ?? null) : log.photoId;
    if (local?.photoId && local.photoId !== photoId) orphanedPhotoIds.push(local.photoId);
    writes.push({ ...log, recipeId: log.recipeId && recipeIds.has(log.recipeId) ? log.recipeId : null, photoId });
    finalPhotoIds.set(log.id, photoId);
    if (local) result.logsUpdated += 1;
    else result.logsAdded += 1;
  });
  await db.logs.bulkPut(writes);
  await db.photos.bulkDelete(orphanedPhotoIds);
  return finalPhotoIds;
}

async function writePhotos(
  backup: LoadedBackup,
  finalPhotoIds: Map<string, string | null>,
  result: RestoreResult,
): Promise<void> {
  const wanted = backup.photos.filter((p) => finalPhotoIds.get(p.logId) === p.id);
  const present = new Set(await db.photos.where(":id").anyOf(wanted.map((p) => p.id)).primaryKeys());
  const writes = wanted.filter((p) => !present.has(p.id));
  await db.photos.bulkPut(writes);
  result.photos = writes.length;
  result.skipped += backup.photos.length - writes.length;
}

async function writeCookState(states: readonly CookState[]): Promise<void> {
  const ids = states.map((s) => s.recipeId);
  const recipes = await db.recipes.bulkGet(ids);
  const locals = await db.cookState.bulkGet(ids);
  const writes: CookState[] = [];
  states.forEach((state, i) => {
    const recipe = recipes[i];
    const local = locals[i];
    if (!recipe || (local && local.updatedAt >= state.updatedAt)) return;
    // Re-check against the recipe as it is now (this device's copy may have been kept).
    writes.push(sanitizeCookState(state, recipe));
  });
  await db.cookState.bulkPut(writes);
}

/**
 * Restores a loaded backup in one transaction.
 * - merge: adds records this device doesn't have; for ids on both sides the newer
 *   `updatedAt` wins. Never duplicates, never deletes anything that isn't replaced.
 * - replace: wipes recipes, logs, photos and cooking progress, then loads the backup.
 */
export async function restoreBackup(backup: LoadedBackup, mode: RestoreMode = "merge"): Promise<RestoreResult> {
  const result: RestoreResult = {
    mode,
    recipesAdded: 0,
    recipesUpdated: 0,
    logsAdded: 0,
    logsUpdated: 0,
    photos: 0,
    skipped: backup.dropped,
    warnings: [...backup.warnings],
  };
  await db.transaction("rw", userTables(), async () => {
    if (mode === "replace") await clearUserTables();
    else await replaceUntouchedStarters(backup.recipes);
    await writeRecipes(backup.recipes, result);
    const finalPhotoIds = await writeLogs(backup, mode, result);
    await writePhotos(backup, finalPhotoIds, result);
    await writeCookState(backup.cookState);
  });
  return result;
}
