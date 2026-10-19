// Reading everything out of IndexedDB and turning it into the backup JSON document.

import { db } from "@/lib/db";
import { todayKey } from "@/lib/dates";
import type { Photo } from "@/lib/types";
import { extensionForMime, toDataUrl } from "./encoding";
import {
  APP_VERSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupDocument,
  type BackupPhoto,
  type DataSnapshot,
  type ExportKind,
} from "./types";

/** One consistent read of every table a backup covers. */
export async function readSnapshot(): Promise<DataSnapshot> {
  return db.transaction("r", [db.recipes, db.logs, db.cookState, db.photos], async () => {
    const recipes = await db.recipes.toArray();
    const logs = await db.logs.toArray();
    const cookState = await db.cookState.toArray();
    const photos = await db.photos.toArray();
    return { recipes, logs, cookState, photos };
  });
}

/** "culinarylog-backup-2026-10-16.zip" (local date). */
export function exportFileName(kind: ExportKind, now: Date = new Date()): string {
  const day = todayKey(now);
  if (kind === "markdown") return `culinarylog-recipes-${day}.md`;
  return `culinarylog-backup-${day}.${kind}`;
}

/** Where a photo's bytes live inside the .zip. */
export function photoPaths(photo: Pick<Photo, "id" | "mime">): { file: string; thumbFile: string } {
  const ext = extensionForMime(photo.mime);
  return { file: `photos/${photo.id}.${ext}`, thumbFile: `photos/${photo.id}-thumb.${ext}` };
}

/**
 * - "files": photos reference files inside the .zip
 * - "embed": photos carry base64 data URLs (portable single-file JSON)
 * - "omit": no photos at all
 */
export type PhotoMode = "files" | "embed" | "omit";

function backupPhoto(photo: Photo, mode: Exclude<PhotoMode, "omit">): BackupPhoto {
  const meta = {
    id: photo.id,
    logId: photo.logId,
    mime: photo.mime,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
  };
  if (mode === "files") return { ...meta, ...photoPaths(photo) };
  return { ...meta, data: toDataUrl(photo.data, photo.mime), thumb: toDataUrl(photo.thumb, photo.mime) };
}

export function buildBackupDocument(
  snapshot: DataSnapshot,
  options: { photos: PhotoMode; now?: Date },
): BackupDocument {
  const now = options.now ?? new Date();
  const mode = options.photos;
  const photos = mode === "omit" ? [] : snapshot.photos.map((p) => backupPhoto(p, mode));
  // Stable, chronological order keeps successive backups diff-friendly.
  const recipes = [...snapshot.recipes].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const logs = [...snapshot.logs].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "CulinaryLog",
    appVersion: APP_VERSION,
    exportedAt: now.toISOString(),
    counts: { recipes: recipes.length, logs: logs.length, photos: photos.length },
    recipes,
    logs,
    cookState: [...snapshot.cookState],
    photos,
  };
}
