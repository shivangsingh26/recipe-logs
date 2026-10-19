// Cook log mutations. A log may own one photo (stored in `photos`, linked both ways).

import { newId } from "@/lib/ids";
import type { CookLog, CookLogInput, MealType, Photo, PhotoInput } from "@/lib/types";
import { db } from "./db";
import { normalizeLogInput } from "./normalize";

/** Order of meals within a day, for display. */
export const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

/** Newest day first; within a day breakfast → lunch → snack → dinner, then by creation. */
export function compareLogsNewestFirst(a: CookLog, b: CookLog): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const meal = MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];
  return meal !== 0 ? meal : a.createdAt - b.createdAt;
}

function photoRecord(id: string, logId: string, input: PhotoInput, now: number): Photo {
  return { id, logId, mime: input.mime, data: input.data, thumb: input.thumb, width: input.width, height: input.height, createdAt: now };
}

export async function createLog(input: CookLogInput, photo?: PhotoInput | null): Promise<CookLog> {
  const clean = normalizeLogInput(input);
  const now = Date.now();
  const log: CookLog = { id: newId(), ...clean, photoId: photo ? newId() : null, createdAt: now, updatedAt: now };
  await db.transaction("rw", db.logs, db.photos, async () => {
    if (photo && log.photoId) await db.photos.add(photoRecord(log.photoId, log.id, photo, now));
    await db.logs.add(log);
  });
  return log;
}

/**
 * Updates a log entry.
 * `photo`: undefined keeps the current photo, null removes it, a PhotoInput replaces it.
 */
export async function updateLog(id: string, input: CookLogInput, photo?: PhotoInput | null): Promise<CookLog> {
  const clean = normalizeLogInput(input);
  return db.transaction("rw", db.logs, db.photos, async () => {
    const existing = await db.logs.get(id);
    if (!existing) throw new Error("Log entry not found");
    const now = Date.now();
    let photoId = existing.photoId;
    if (photo !== undefined) {
      if (existing.photoId) await db.photos.delete(existing.photoId);
      photoId = null;
      if (photo) {
        photoId = newId();
        await db.photos.add(photoRecord(photoId, id, photo, now));
      }
    }
    const next: CookLog = { ...existing, ...clean, photoId, updatedAt: now };
    await db.logs.put(next);
    return next;
  });
}

export interface DeletedLog {
  log: CookLog;
  photo: Photo | undefined;
}

export async function deleteLog(id: string): Promise<DeletedLog | null> {
  return db.transaction("rw", db.logs, db.photos, async () => {
    const log = await db.logs.get(id);
    if (!log) return null;
    const photo = log.photoId ? await db.photos.get(log.photoId) : undefined;
    if (log.photoId) await db.photos.delete(log.photoId);
    await db.logs.delete(id);
    return { log, photo };
  });
}

export async function undoDeleteLog(snapshot: DeletedLog): Promise<void> {
  await db.transaction("rw", db.logs, db.photos, async () => {
    if (snapshot.photo) await db.photos.put(snapshot.photo);
    await db.logs.put(snapshot.log);
  });
}
