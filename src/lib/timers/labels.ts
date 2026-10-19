// Words for timers: screen-reader labels and "finished 3 min ago".

function parts(totalSeconds: number): { h: number; m: number; s: number } {
  const t = Math.max(0, Math.round(totalSeconds));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** 761 → "12 minutes 41 seconds"; 5400 → "1 hour 30 minutes". */
export function spokenDuration(totalSeconds: number): string {
  const { h, m, s } = parts(totalSeconds);
  const out: string[] = [];
  if (h) out.push(unit(h, "hour"));
  if (m) out.push(unit(m, "minute"));
  if (s || out.length === 0) out.push(unit(s, "second"));
  return out.join(" ");
}

/** Adjective form for "Start 14 minute timer": 840 → "14 minute", 5400 → "1 hour 30 minute". */
export function spokenLength(totalSeconds: number): string {
  const { h, m, s } = parts(totalSeconds);
  const out: string[] = [];
  if (h) out.push(`${h} hour`);
  if (m) out.push(`${m} minute`);
  if (s || out.length === 0) out.push(`${s} second`);
  return out.join(" ");
}

/** 30_000 → "just now", 180_000 → "3 min ago", 7_200_000 → "2 h ago". */
export function finishedAgo(elapsedMs: number): string {
  const minutes = Math.floor(Math.max(0, elapsedMs) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}
