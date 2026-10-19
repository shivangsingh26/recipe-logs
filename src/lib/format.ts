// Display formatting shared across screens.

/** 45 → "45 min", 75 → "1 h 15 min", 120 → "2 h". null/0 → "". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "";
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Prep + cook, ignoring unknowns. Returns null when both are unknown. */
export function totalMinutes(prep: number | null, cook: number | null): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

/** Countdown display: 840 → "14:00", 3725 → "1:02:05". Negative values clamp to 0. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** 840 → "14 min", 90 → "1 min 30 s", 5400 → "1 h 30 min". For labels, not countdowns. */
export function formatDurationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (sec && !h) parts.push(`${sec} s`);
  return parts.join(" ") || "0 s";
}

/** Rounds for display: 46 → "46", 12.5 → "12.5", 12.04 → "12". */
export function formatNumber(value: number | null | undefined, maxFractionDigits = 1): string {
  if (value == null || !Number.isFinite(value)) return "";
  return Number(value.toFixed(maxFractionDigits)).toString();
}

/** "Kacchi Chicken Dum Biryani (5L Cooker)" → "kacchi-chicken-dum-biryani-5l-cooker". */
export function slugify(text: string, maxLength = 60): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
