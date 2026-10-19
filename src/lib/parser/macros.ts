// Nutrition in the shapes chat assistants and recipe sites use: "Calories: ~770 kcal",
// "Protein — 46g", "P: 46 g", "46g protein", "770 kcal | 46g P | 94g C | 23g F",
// "Per serving: 770 kcal, 46 g protein, …", and Markdown tables (horizontal or Nutrient | Amount).

import { stripEmphasis, stripLinks } from "./text";

export interface MacroValues {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Energy given only in kJ; converted to kcal at the end. */
  kj?: number;
}

export type MacroKey = keyof MacroValues;
export type MacroScope = "serving" | "total";

export interface MacroScan {
  values: MacroValues;
  count: number;
  /** True when the text is nothing but macros (labels, numbers, units, filler words). */
  pure: boolean;
  /** Whether the text itself says "per serving" or "whole recipe". */
  scope: MacroScope | null;
  /** The text starts with a macro label ("Calories: 770") rather than prose. */
  labelled: boolean;
}

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?`;
const APPROX = String.raw`(?:(?:~|≈|±|approx(?:\.|imately)?|about|around|roughly|est(?:\.|imated)?|ca\.?)\s*)?`;
const RANGE = String.raw`(${NUM})(?:\s*(?:-|–|—|to)\s*(${NUM}))?`;
const NOT_SUBTYPE = String.raw`(?<!(?:saturated|unsaturated|monounsaturated|polyunsaturated|trans|net|added)\s)`;
const WORD_LABEL = String.raw`calories|kcals?|cals?|energy|proteins?|carbohydrates?|carbs?|fats?|total\s+(?:fats?|carbs?|carbohydrates?)`;

// Label first: "Protein — 46 g", "Calories 770", "P: 46g" (single letters need a colon).
const LABEL_FIRST = new RegExp(
  String.raw`(?<![\w-])${NOT_SUBTYPE}(?:(${WORD_LABEL})\b|(?<![°º\d])([PCF])(?=\s*:))\s*(?:\(([^)]*)\))?\s*[:=\-–—]?\s*${APPROX}${RANGE}\s*(kcal|kj|cal(?:ories)?|cals|g|grams?|gm)?(?![a-z])`,
  "gi",
);
// Number first: "770 kcal", "46g protein", "23 g of fat", "94g C".
const NUMBER_FIRST = new RegExp(
  String.raw`(?<![\w.,])${APPROX}${RANGE}\s*(?:(kcal|kj|cal(?:ories)?|cals)(?![a-z])|(?:g|grams?|gm)\s*(?:of\s+)?(proteins?|carbohydrates?|carbs?|fats?|[PCF])(?![a-z]))`,
  "gi",
);

const LEADING_LABEL = new RegExp(String.raw`^(?:${WORD_LABEL})\b|^[PCF]\s*:`, "i");

const FILLER =
  /\b(?:per|serving|servings|portion|portions|each|approx(?:imately)?|about|around|roughly|estimated?|est|kcal|kcals|cal|cals|calories|g|grams?|gm|kj|macros?|macronutrients|nutrition(?:al)?|info(?:rmation)?|facts|total|totals|whole|recipe|dish|batch|and|with|of|the|plate|bowl|serve|values?|amount|nutrients?|in|for|a|an|one|1)\b/gi;

function toNumber(raw: string): number {
  const clean = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
  return Number(clean);
}

function rangeValue(low: string, high: string | undefined): number | null {
  const a = toNumber(low);
  if (!Number.isFinite(a)) return null;
  if (!high) return a;
  const b = toNumber(high);
  return Number.isFinite(b) && b >= a ? (a + b) / 2 : a;
}

function keyForLabel(label: string, unit: string | undefined): MacroKey | null {
  const l = label.toLowerCase().replace(/\s+/g, " ");
  if (/^(?:calories|kcals?|cals?|energy)$/.test(l)) return unit?.toLowerCase() === "kj" ? "kj" : "calories";
  if (/^proteins?$|^p$/.test(l)) return "protein";
  if (/carb|^c$/.test(l)) return "carbs";
  if (/fat|^f$/.test(l)) return "fat";
  return null;
}

interface Hit {
  start: number;
  end: number;
  key: MacroKey;
  value: number;
}

function labelHits(text: string): Hit[] {
  const hits: Hit[] = [];
  LABEL_FIRST.lastIndex = 0;
  for (let m = LABEL_FIRST.exec(text); m; m = LABEL_FIRST.exec(text)) {
    const [whole, word, letter, paren, low, high, unit] = m;
    const unitHint = unit ?? (paren && /kj/i.test(paren) ? "kj" : undefined);
    const key = keyForLabel(word ?? letter, unitHint);
    const value = rangeValue(low, high);
    if (key && value != null) hits.push({ start: m.index, end: m.index + whole.length, key, value });
  }
  return hits;
}

function numberHits(text: string): Hit[] {
  const hits: Hit[] = [];
  NUMBER_FIRST.lastIndex = 0;
  for (let m = NUMBER_FIRST.exec(text); m; m = NUMBER_FIRST.exec(text)) {
    const [whole, low, high, energyUnit, nutrient] = m;
    const key = energyUnit ? (energyUnit.toLowerCase() === "kj" ? "kj" : "calories") : keyForLabel(nutrient, "g");
    const value = rangeValue(low, high);
    if (key && value != null) hits.push({ start: m.index, end: m.index + whole.length, key, value });
  }
  return hits;
}

/** "Total fat" is a nutrient, not a scope; strip those before looking for scope words. */
export function macroScope(text: string): MacroScope | null {
  const t = text.toLowerCase().replace(/total\s+(?:fats?|carb\w*|calor\w*|energy|kcal|protein|sugars?|fib(?:er|re))/g, " ");
  if (/\bper\s+(?:serving|portion|plate|person|bowl|piece|serve)\b|\beach\s+serving\b|\b1\s+serving\b/.test(t)) {
    return "serving";
  }
  if (/\b(?:total|totals|whole(?:\s+(?:recipe|dish|batch|pot))?|entire\s+(?:recipe|dish|batch)|full\s+recipe|all\s+servings|in\s+total|batch)\b/.test(t)) {
    return "total";
  }
  return null;
}

/** Finds macro values in one line of text. */
export function scanMacros(input: string): MacroScan {
  const text = stripEmphasis(stripLinks(input));
  const lead = text
    .replace(/^[\s\-*•+|>]*/, "")
    .replace(/^(?:(?:macros?|nutrition(?:al)?(?:\s+(?:info(?:rmation)?|facts))?|per\s+(?:serving|portion)|each\s+serving|approx(?:imate(?:ly)?)?)\b[^:\d]*:?\s*)+/i, "");
  const numberMode = /^(?:~|≈|approx\.?\s*|about\s+)?\d/i.test(lead);
  const [primary, secondary] = numberMode ? [numberHits(text), labelHits(text)] : [labelHits(text), numberHits(text)];

  const accepted: Hit[] = [];
  const overlaps = (h: Hit) => accepted.some((a) => h.start < a.end && a.start < h.end);
  for (const hit of [...primary, ...secondary]) if (!overlaps(hit)) accepted.push(hit);

  const values: MacroValues = {};
  for (const hit of accepted.sort((a, b) => a.start - b.start)) {
    if (values[hit.key] === undefined) values[hit.key] = hit.value;
  }

  let remainder = text;
  for (const hit of [...accepted].sort((a, b) => b.start - a.start)) {
    remainder = remainder.slice(0, hit.start) + " " + remainder.slice(hit.end);
  }
  const leftover = remainder.replace(/\([^)]*\)/g, " ").replace(FILLER, " ").replace(/[^a-z]/gi, "");
  const count = Object.keys(values).length;
  return {
    values,
    count,
    pure: count > 0 && leftover.length <= (count > 1 ? 10 : 2),
    scope: macroScope(text),
    labelled: accepted.length > 0 && LEADING_LABEL.test(lead),
  };
}

/** Value of one table cell: "~770 kcal" → 770, "40–50 g" → 45, "—" → null. */
export function parseMacroCell(cell: string): { value: number; unit: string | null } | null {
  const m = new RegExp(String.raw`${APPROX}${RANGE}\s*(kcal|kj|cal(?:ories)?|g|grams?|gm)?`, "i").exec(stripEmphasis(cell));
  if (!m) return null;
  const value = rangeValue(m[1], m[2]);
  return value == null ? null : { value, unit: m[3]?.toLowerCase() ?? null };
}

function headerKey(cell: string): MacroKey | null {
  const t = stripEmphasis(cell).toLowerCase().trim();
  const unit = /\bkj\b/.test(t) ? "kj" : undefined;
  const m = new RegExp(String.raw`^(?:${WORD_LABEL}|[pcf])\b`, "i").exec(t.replace(/^total\s+(?=fat|carb)/, ""));
  return m ? keyForLabel(m[0], unit) : null;
}

/**
 * Reads a Markdown table of nutrition. Accepts a header row of nutrients
 * (| Calories | Protein | Carbs | Fat |) or rows of nutrient/amount pairs.
 */
export function parseMacroTable(rows: readonly string[][], minCount = 1): { values: MacroValues; scope: MacroScope | null } | null {
  if (rows.length === 0) return null;
  const header = rows[0];

  // Horizontal: nutrients across the header row.
  const columns = header.map(headerKey);
  if (columns.filter(Boolean).length >= minCount && rows.length > 1) {
    const dataRows = rows.slice(1);
    const labelOf = (row: string[]) => row.filter((_, i) => !columns[i]).join(" ");
    const row =
      dataRows.find((r) => macroScope(labelOf(r)) === "serving") ??
      dataRows.find((r) => macroScope(labelOf(r)) !== "total") ??
      dataRows[0];
    const values: MacroValues = {};
    columns.forEach((key, i) => {
      const cell = key ? parseMacroCell(row[i] ?? "") : null;
      if (key && cell) values[cell.unit === "kj" && key === "calories" ? "kj" : key] ??= cell.value;
    });
    if (Object.keys(values).length >= minCount) {
      return { values, scope: macroScope(labelOf(row)) ?? macroScope(header.join(" ")) };
    }
  }

  // Vertical: | Calories | 770 kcal | rows, optionally under a | Nutrient | Per serving | Total | header.
  const headerIsData = headerKey(header[0] ?? "") !== null;
  const body = headerIsData ? rows : rows.slice(1);
  const valueHeaders = headerIsData ? [] : header.slice(1);
  let column = 1;
  if (valueHeaders.length > 1) {
    const serving = valueHeaders.findIndex((h) => macroScope(h) === "serving" || /serving|portion|each/i.test(h));
    const notTotal = valueHeaders.findIndex((h) => macroScope(h) !== "total");
    column = 1 + (serving >= 0 ? serving : Math.max(0, notTotal));
  }
  const values: MacroValues = {};
  for (const row of body) {
    const key = headerKey(row[0] ?? "");
    const cell = key ? parseMacroCell(row[column] ?? "") : null;
    if (key && cell) values[cell.unit === "kj" && key === "calories" ? "kj" : key] ??= cell.value;
  }
  if (Object.keys(values).length < minCount) return null;
  return { values, scope: valueHeaders[column - 1] ? macroScope(valueHeaders[column - 1]) : null };
}
