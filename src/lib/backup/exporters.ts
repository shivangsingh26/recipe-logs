// Export files built from the current data: full .zip backup, single-file JSON, Markdown.

import { setPrefs } from "@/lib/prefs";
import { buildBackupDocument, exportFileName, readSnapshot } from "./document";
import { buildMarkdownExport } from "./markdown";
import type { ExportKind } from "./types";
import { buildBackupZip } from "./zip";

const MIME: Record<ExportKind, string> = {
  zip: "application/zip",
  json: "application/json",
  markdown: "text/markdown",
};

export interface ExportOptions {
  /** JSON only: embed photos as data URLs (default true). */
  includePhotos?: boolean;
  now?: Date;
}

export async function createExportFile(kind: ExportKind, options: ExportOptions = {}): Promise<File> {
  const now = options.now ?? new Date();
  const snapshot = await readSnapshot();
  let content: BlobPart;
  if (kind === "zip") {
    content = buildBackupZip(snapshot, now);
  } else if (kind === "json") {
    const doc = buildBackupDocument(snapshot, { photos: options.includePhotos === false ? "omit" : "embed", now });
    content = JSON.stringify(doc, null, 2);
  } else {
    content = buildMarkdownExport(snapshot, now);
  }
  return new File([content], exportFileName(kind, now), { type: MIME[kind], lastModified: now.getTime() });
}

/** Call after an export was handed off. Markdown alone can't be restored, so it doesn't count as a backup. */
export function recordBackup(kind: ExportKind, at: number = Date.now()): void {
  if (kind !== "markdown") setPrefs({ lastBackupAt: at });
}
