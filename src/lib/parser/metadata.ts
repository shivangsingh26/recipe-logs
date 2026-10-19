// Recipe facts written as labels, alone or several per line:
// "Prep time: 20 mins", "- **Serves:** 4–6", "Prep: 20 min | Cook: 45 min | Serves 4",
// "Tags: Indian, Dinner", "Source: [Serious Eats](https://…)", "4 servings", "20 min prep".

import { findDurations, parseCount, parseDurationMinutes } from "./durations";
import {
  collapseSpaces,
  firstLinkUrl,
  startsEscaped,
  stripBullet,
  stripEmoji,
  stripEmphasis,
  stripLinks,
  unescapeMarkdown,
  wordCount,
} from "./text";

export interface MetaPatch {
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  servings?: number;
  categories?: string[];
  source?: string;
  description?: string;
}

export interface MetadataLine {
  patch: MetaPatch;
  /** Segments of the line that were not metadata ("Marinate: 2 hours"), joined with " · ". */
  rest: string;
}

type Field = "prep" | "cook" | "total" | "servings" | "categories" | "source" | "description";

const LABELS: ReadonlyArray<readonly [Field, RegExp]> = [
  ["prep", /^(?:prep(?:aration)?|active)(?:\s+time)?$/i],
  ["cook", /^(?:cook(?:ing)?|bake|baking|roasting|frying)(?:\s+time)?$/i],
  ["total", /^(?:total(?:\s+(?:cook(?:ing)?\s+)?time)?|time|ready\s+in)$/i],
  ["servings", /^(?:servings?|serves|portions?|yields?|makes|feeds|number\s+of\s+servings)$/i],
  ["categories", /^(?:categor(?:y|ies)|tags?|course|cuisine|diet|meal(?:\s+type)?|keywords?)$/i],
  [
    "source",
    /^(?:source|adapted\s+from|recipe\s+(?:from|by)|url|link|original\s+recipe|credit|inspired\s+by|based\s+on)$/i,
  ],
  ["description", /^(?:description|summary)$/i],
];

const CONSUMES_REST: ReadonlySet<Field> = new Set(["categories", "source", "description"]);

const LABELLED = /^([a-z][a-z'& ]{0,30}?)\s*(?:\([^)]*\))?\s*(?::|=|[-–—](?=\s))\s*(.*)$/i;
const SPACED =
  /^(prep(?:aration)?(?:\s+time)?|cook(?:ing)?(?:\s+time)?|total(?:\s+time)?|ready\s+in|serves|servings?|portions|makes|feeds|yields?|adapted\s+from|recipe\s+(?:from|by)|inspired\s+by|based\s+on)\s+(.+)$/i;
const REVERSED_SERVINGS = /^(\S+(?:\s*(?:-|–|—|to)\s*\S+)?)\s+(?:servings?|portions?|people|persons|plates)$/i;
const REVERSED_TIME = /^(.{1,24}?)\s+(prep(?:aration)?|cook(?:ing)?|total)(?:\s+time)?$/i;
const LABEL_HINT = "(?:prep|preparation|cook|cooking|total|ready in|serves|servings|yield|makes|feeds|tags|category|cuisine|course|source)\\b";
const SEGMENT_SPLIT = new RegExp(
  `\\s*(?<!\\\\)[|·•;]\\s*|\\s*,\\s*(?=${LABEL_HINT})|\\s+[–—]\\s+(?=${LABEL_HINT})`,
  "gi",
);
const APPROX = /^(?:~|≈|approx(?:\.|imately)?|about|around|roughly|up\s+to)\s*/i;

function fieldFor(label: string): Field | null {
  const clean = collapseSpaces(label);
  for (const [field, pattern] of LABELS) if (pattern.test(clean)) return field;
  return null;
}

/** Bullets, emoji, links and emphasis removed; escapes kept so escaped separators survive splitting. */
function cleanMetaText(line: string): { text: string; linkUrl: string | null } {
  const unbulleted = stripBullet(line.trim());
  const linkUrl = firstLinkUrl(unbulleted);
  return { text: collapseSpaces(stripEmphasis(stripLinks(stripEmoji(unbulleted)))), linkUrl };
}

/** Splits "a, b · c / d" on unescaped separators. */
export function splitList(value: string): string[] {
  return value
    .split(/\s*(?<!\\)[,·|;/•]\s*/)
    .map((part) =>
      collapseSpaces(stripEmoji(unescapeMarkdown(part)))
        .replace(/^#(?=\S)/, "")
        .replace(/[.\s]+$/, ""),
    )
    .filter((part) => part.length > 0 && part.length <= 40);
}

function parseServings(value: string): number | null {
  const v = value.replace(/\([^)]*\)/g, " ").replace(APPROX, "").trim();
  if (!v || wordCount(v) > 4) return null;
  const n = parseCount(v);
  return n != null && n > 0 && n <= 1000 ? n : null;
}

function parseMinutes(value: string): number | null {
  const v = value.replace(APPROX, "").trim();
  if (!v || wordCount(v) > 10) return null;
  const minutes = parseDurationMinutes(v);
  if (minutes == null || minutes <= 0) return null;
  // The duration must lead the value: "Cook: sear for 5 min, then…" is a sentence, not a cook time.
  return /^[\d¼½¾⅓⅔⅛⅜⅝⅞]|^(?:an?|one|two|three|four|five|six|half|ninety|thirty|forty|twenty|fifteen|ten)\b/i.test(v)
    ? minutes
    : null;
}

function applyField(field: Field, value: string, linkUrl: string | null): MetaPatch | null {
  switch (field) {
    case "prep":
    case "cook":
    case "total": {
      const minutes = parseMinutes(value);
      if (minutes == null) return null;
      return field === "prep"
        ? { prepMinutes: minutes }
        : field === "cook"
          ? { cookMinutes: minutes }
          : { totalMinutes: minutes };
    }
    case "servings": {
      const servings = parseServings(value);
      return servings == null ? null : { servings };
    }
    case "categories": {
      const categories = splitList(value);
      return categories.length ? { categories } : null;
    }
    case "source": {
      const source = linkUrl ?? collapseSpaces(unescapeMarkdown(value)).replace(/^<|>$/g, "");
      return source ? { source } : null;
    }
    case "description": {
      const description = collapseSpaces(unescapeMarkdown(value));
      return description ? { description } : null;
    }
  }
}

function parseSegment(
  segment: string,
  restOfLine: string,
  linkUrl: string | null,
): { patch: MetaPatch; consumesRest: boolean } | null {
  const labelled = LABELLED.exec(segment);
  if (labelled) {
    const field = fieldFor(labelled[1]);
    if (field) {
      const consumesRest = CONSUMES_REST.has(field);
      const value = consumesRest ? (LABELLED.exec(restOfLine)?.[2] ?? labelled[2]) : labelled[2];
      const patch = applyField(field, value, linkUrl);
      return patch ? { patch, consumesRest } : null;
    }
  }
  const spaced = SPACED.exec(segment);
  if (spaced) {
    const field = fieldFor(spaced[1]);
    if (field) {
      const consumesRest = CONSUMES_REST.has(field);
      const value = consumesRest ? (SPACED.exec(restOfLine)?.[2] ?? spaced[2]) : spaced[2];
      const patch = applyField(field, value, linkUrl);
      if (patch) return { patch, consumesRest };
    }
  }
  const servings = REVERSED_SERVINGS.exec(segment);
  if (servings) {
    const patch = applyField("servings", servings[1], null);
    if (patch) return { patch, consumesRest: false };
  }
  const time = REVERSED_TIME.exec(segment);
  if (time) {
    const field = fieldFor(time[2]);
    const patch = field ? applyField(field, time[1], null) : null;
    if (patch) return { patch, consumesRest: false };
  }
  return null;
}

/** A later segment that is only a duration ("Serves 4 · 45 min") is the total time. */
function bareTime(segment: string, index: number): { patch: MetaPatch; consumesRest: boolean } | null {
  if (index === 0) return null;
  const [match] = findDurations(segment);
  if (!match || match.start > 2 || segment.slice(match.end).trim()) return null;
  return { patch: { totalMinutes: Math.round((match.seconds / 60) * 10) / 10 }, consumesRest: false };
}

function segmentsOf(text: string): Array<{ text: string; start: number }> {
  const out: Array<{ text: string; start: number }> = [];
  let start = 0;
  SEGMENT_SPLIT.lastIndex = 0;
  for (let m = SEGMENT_SPLIT.exec(text); m; m = SEGMENT_SPLIT.exec(text)) {
    if (m[0].length === 0) {
      SEGMENT_SPLIT.lastIndex++;
      continue;
    }
    out.push({ text: text.slice(start, m.index).trim(), start });
    start = m.index + m[0].length;
  }
  out.push({ text: text.slice(start).trim(), start });
  return out.filter((s) => s.text.length > 0);
}

/**
 * Reads metadata from one line. The first segment must be metadata; later segments that
 * are not are returned in `rest`. Returns null when the line is not metadata at all.
 */
export function parseMetadataLine(line: string): MetadataLine | null {
  const { text, linkUrl } = cleanMetaText(line);
  if (!text || text.length > 400 || startsEscaped(text)) return null;
  const patch: MetaPatch = {};
  const rest: string[] = [];
  let found = 0;
  const segments = segmentsOf(text);
  for (let i = 0; i < segments.length; i++) {
    const parsed = parseSegment(segments[i].text, text.slice(segments[i].start), linkUrl) ?? bareTime(segments[i].text, i);
    if (!parsed) {
      if (i === 0) return null;
      rest.push(segments[i].text);
      continue;
    }
    found++;
    for (const [key, value] of Object.entries(parsed.patch) as Array<[keyof MetaPatch, MetaPatch[keyof MetaPatch]]>) {
      if (patch[key] === undefined) Object.assign(patch, { [key]: value });
    }
    if (parsed.consumesRest) break;
  }
  return found ? { patch, rest: unescapeMarkdown(rest.join(" · ")) } : null;
}

/** Servings phrase inside a heading qualifier: "serves 4", "for 4 people", "4 servings", "makes 12". */
export function servingsFromPhrase(phrase: string): number | null {
  const m =
    /^(?:serves|makes|feeds|yields?)\s+(.+)$/i.exec(phrase.trim()) ??
    /^for\s+(\S+)(?:\s+(?:people|persons|servings?|portions?))?$/i.exec(phrase.trim()) ??
    /^(\S+)\s+(?:servings?|portions?|people|persons)$/i.exec(phrase.trim());
  return m ? parseServings(m[1]) : null;
}
