// The full backup archive: JSON + photo files + per-recipe Markdown + cook log + README.

import { strToU8, zipSync, type ZipOptions, type Zippable } from "fflate";
import { recipeToMarkdown } from "@/lib/markdown/recipeMarkdown";
import { buildBackupDocument, photoPaths } from "./document";
import { backupReadme, cookLogToMarkdown, recipeFilePaths } from "./markdown";
import { BACKUP_JSON_NAME, type DataSnapshot } from "./types";

// JPEGs are already compressed: store them as-is and only deflate the text files.
const STORE: ZipOptions = { level: 0 };
const DEFLATE: ZipOptions = { level: 6 };

export function buildBackupZip(snapshot: DataSnapshot, now: Date = new Date()): Uint8Array<ArrayBuffer> {
  const doc = buildBackupDocument(snapshot, { photos: "files", now });
  const text = (content: string): [Uint8Array, ZipOptions] => [strToU8(content), DEFLATE];
  const files: Zippable = {
    [BACKUP_JSON_NAME]: text(JSON.stringify(doc, null, 2)),
    "README.txt": text(backupReadme(doc, now)),
  };

  const photoLinks = new Map<string, string>();
  for (const photo of snapshot.photos) {
    const paths = photoPaths(photo);
    files[paths.file] = [new Uint8Array(photo.data), STORE];
    files[paths.thumbFile] = [new Uint8Array(photo.thumb), STORE];
    photoLinks.set(photo.id, paths.file);
  }

  const recipePaths = recipeFilePaths(snapshot.recipes);
  for (const recipe of snapshot.recipes) {
    const path = recipePaths.get(recipe.id);
    if (path) files[path] = text(recipeToMarkdown(recipe));
  }
  files["cook-log.md"] = text(cookLogToMarkdown(snapshot.logs, { photoPaths: photoLinks }));

  return zipSync(files, { mtime: now });
}
