// Finds cooking durations in free text — "14 min", "1 hr 30 min", "5–6 minutes", "half an hour" —
// so recipe steps can offer tap-to-start timers, and reads metadata times ("Prep: 1h15m").
// Only time units count, so temperatures (160°C), volumes (2.5 L), spoons, inches, whistles,
// clock times ("5 pm") and years never match.

export interface DurationMatch {
  start: number;
  end: number;
  /** Length in seconds; for ranges ("5–6 min") the lower bound. */
  seconds: number;
  /** The exact matched text, e.g. "5–6 min". */
  label: string;
}

const FRACTIONS: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};
const FRACTION_CLASS = Object.keys(FRACTIONS).join("");

const WORD_VALUES: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  ninety: 90,
};

const WORDS =
  "half\\s+an?|a\\s+half|forty[- ]five|twenty|thirty|forty|fifty|sixty|ninety|fifteen|twelve|eleven|ten|nine|eight|seven|six|five|four|three|two|one|an|a";
const NUMBER =
  `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s?[${FRACTION_CLASS}])?|[${FRACTION_CLASS}]|(?:${WORDS})\\b)`;
const UNIT = "(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])";
const RANGE_SEP = "\\s*(?:-|–|—|\\bto\\b|\\bor\\b)\\s*";

// 1 = number, 2 = range upper bound, 3 = number/unit separator, 4 = unit, 5 = "and a half"
const ATOM = new RegExp(
  // Not inside a word or number, except right after a glued unit ("1h|30m", "1m|30s").
  `(?:(?<![\\w.,/])|(?<=\\d[hHmM]))(${NUMBER})(?:${RANGE_SEP}(${NUMBER}))?(\\s*-\\s*|\\s*)${UNIT}(\\s+and\\s+a\\s+half\\b)?`,
  "gi",
);

const COMPOUND_GAP = /^\s*\.?\s*(?:,\s*|and\s+|&\s*)?$/i;

interface Atom {
  start: number;
  end: number;
  seconds: number;
  /** Seconds per unit of the smallest unit so far (3600, 60 or 1). */
  rank: number;
  range: boolean;
  /** "30s" style: only meaningful as the tail of "1m30s". */
  bareSeconds: boolean;
}

function numberValue(raw: string): number | null {
  const t = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^half an?$|^a half$/.test(t)) return 0.5;
  if (/^forty[- ]five$/.test(t)) return 45;
  if (t in WORD_VALUES) return WORD_VALUES[t];
  let m = /^(\d+) (\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  if (t in FRACTIONS) return FRACTIONS[t];
  m = /^(\d+(?:[.,]\d+)?) ?(.)?$/.exec(t);
  if (m) {
    const base = Number(m[1].replace(",", "."));
    const frac = m[2] ? FRACTIONS[m[2]] : 0;
    return Number.isFinite(base) && frac != null ? base + frac : null;
  }
  return null;
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("h")) return 3600;
  if (u.startsWith("m")) return 60;
  return 1;
}

function toAtom(m: RegExpExecArray): Atom | null {
  const [whole, first, upper, sep, unit, half] = m;
  const value = numberValue(first);
  if (value == null) return null;
  const isWord = /^[a-z]/i.test(first.trim());
  const u = unit.toLowerCase();
  // Single-letter units only when glued to digits ("10m", "1h30m"); "10 m" could be metres.
  if (u === "h" && isWord) return null;
  if ((u === "m" || u === "s") && (sep !== "" || isWord)) return null;
  const rank = unitSeconds(u);
  // "a second batch" is not a timer.
  if (rank === 1 && isWord) return null;
  const seconds = Math.round((value + (half ? 0.5 : 0)) * rank);
  return {
    start: m.index,
    end: m.index + whole.length,
    seconds,
    rank,
    range: Boolean(upper),
    bareSeconds: u === "s",
  };
}

/** Every duration phrase in `text`, non-overlapping and in order. */
export function findDurations(text: string): DurationMatch[] {
  if (!text) return [];
  const atoms: Atom[] = [];
  ATOM.lastIndex = 0;
  for (let m = ATOM.exec(text); m; m = ATOM.exec(text)) {
    const atom = toAtom(m);
    if (atom) atoms.push(atom);
  }

  // Merge "1 hr" + "30 min" (+ "15 sec") into one compound duration.
  const merged: Atom[] = [];
  for (const atom of atoms) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      !prev.range &&
      !atom.range &&
      atom.rank < prev.rank &&
      COMPOUND_GAP.test(text.slice(prev.end, atom.start))
    ) {
      prev.end = atom.end;
      prev.seconds += atom.seconds;
      prev.rank = atom.rank;
      prev.bareSeconds = false;
      continue;
    }
    merged.push({ ...atom });
  }

  return merged
    .filter((a) => a.seconds > 0 && !a.bareSeconds)
    .map((a) => ({ start: a.start, end: a.end, seconds: a.seconds, label: text.slice(a.start, a.end) }));
}

/** Metadata time in minutes: "20 mins" → 20, "1h15m" → 75, "30-40 min" → 30, "45" → 45. */
export function parseDurationMinutes(text: string): number | null {
  const [first] = findDurations(text);
  if (first) return Math.round((first.seconds / 60) * 10) / 10;
  const bare = /^\s*(\d+(?:\.\d+)?)\s*$/.exec(text);
  return bare ? Number(bare[1]) : null;
}

/** Parses a leading count: "4", "4–6" (→ 4), "four", "2.5". */
export function parseCount(text: string): number | null {
  const m = new RegExp(`^\\s*(${NUMBER})`, "i").exec(text);
  if (!m) return null;
  const token = m[1].trim().toLowerCase();
  if (token === "a" || token === "an" || /half/.test(token)) return null;
  return numberValue(token);
}
