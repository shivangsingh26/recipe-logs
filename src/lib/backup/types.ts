// Backup file format, version 1. The JSON document is what a restore reads; the .zip
// wraps it with the photo files, one Markdown file per recipe and a readable cook log.

import type { CookLog, CookState, Photo, Recipe } from "@/lib/types";

export const BACKUP_FORMAT = "culinarylog-backup";
export const BACKUP_VERSION = 1;
/** Name of the JSON document inside the .zip. */
export const BACKUP_JSON_NAME = "culinarylog-backup.json";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

/** Photo metadata. The bytes travel as files in the .zip, or inline as data URLs in a JSON export. */
export interface BackupPhoto {
  id: string;
  logId: string;
  mime: string;
  width: number;
  height: number;
  createdAt: number;
  /** .zip: path of the full-size image, e.g. "photos/<id>.jpg". */
  file?: string;
  /** .zip: path of the thumbnail, e.g. "photos/<id>-thumb.jpg". */
  thumbFile?: string;
  /** JSON export: base64 data URL of the full-size image. */
  data?: string;
  /** JSON export: base64 data URL of the thumbnail. */
  thumb?: string;
}

export interface BackupCounts {
  recipes: number;
  logs: number;
  photos: number;
}

export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: "CulinaryLog";
  appVersion: string;
  /** ISO timestamp. */
  exportedAt: string;
  counts: BackupCounts;
  recipes: Recipe[];
  logs: CookLog[];
  cookState: CookState[];
  photos: BackupPhoto[];
}

/** Everything a backup contains, as stored in IndexedDB. */
export interface DataSnapshot {
  recipes: Recipe[];
  logs: CookLog[];
  cookState: CookState[];
  photos: Photo[];
}

export type ExportKind = "zip" | "json" | "markdown";

/** A backup file that has been read and sanitised, ready to preview and restore. */
export interface LoadedBackup extends DataSnapshot {
  source: "zip" | "json";
  /** ISO timestamp from the file, or null when missing/unreadable. */
  exportedAt: string | null;
  appVersion: string | null;
  /** Log entries that reference a photo this file doesn't carry (e.g. JSON exported without photos). */
  missingPhotos: number;
  /** Records dropped while reading because they were malformed. */
  dropped: number;
  warnings: string[];
}

/** "merge" adds what's missing and keeps the newer copy of anything in both; "replace" wipes first. */
export type RestoreMode = "merge" | "replace";

export interface RestoreResult {
  mode: RestoreMode;
  recipesAdded: number;
  recipesUpdated: number;
  logsAdded: number;
  logsUpdated: number;
  /** Photos written to this device. */
  photos: number;
  /** Records not written: this device already had the same or a newer copy, or they were unreadable. */
  skipped: number;
  warnings: string[];
}
