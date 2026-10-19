// Recognises section headings ("🧾 Ingredients", "**Method:**", "## Macros (per serving)", a plain
// "Directions" line, a setext underline) and maps their wording to recipe sections.

import { capitalize, cleanHeadingText, startsEscaped, stripEmoji, stripListMarker } from "./text";

export type SectionKind = "ingredients" | "steps" | "notes" | "macros" | "description";

const FOR_QUALIFIER = "(?:\\s+((?:for|to serve)\\b.*))?";

const SECTION_PATTERNS: ReadonlyArray<readonly [SectionKind, RegExp]> = [
  [
    "ingredients",
    new RegExp(
      `^(?:the\\s+)?(?:ingredients?(?:\\s+list)?|what\\s+you(?:'ll|\\s+will)?\\s+need|you(?:'ll|\\s+will)\\s+need|shopping\\s+list|grocery\\s+list)${FOR_QUALIFIER}$`,
      "i",
    ),
  ],
  [
    "steps",
    new RegExp(
      `^(?:the\\s+)?(?:instructions?|method|directions?|steps?|preparation(?:\\s+(?:steps|method))?|procedure|how\\s+to\\s+(?:make|cook|prepare)(?:\\s+(?:it|this|them))?|cooking\\s+(?:steps|instructions|method|directions)|step[- ]by[- ]step(?:\\s+(?:instructions|method|guide))?|recipe\\s+steps)${FOR_QUALIFIER}$`,
      "i",
    ),
  ],
  [
    "notes",
    /^(?:notes?|tips?|notes?\s*(?:&|and)\s*tips?|tips?\s*(?:&|and)\s*(?:notes?|tricks|variations?)|(?:chef|cook)'?s?\s+(?:notes?|tips?)|recipe\s+notes|pro\s+tips?|variations?|storage(?:\s*(?:&|and)\s*(?:reheating|leftovers))?|leftovers|make[- ]ahead(?:\s+tips)?|serving\s+suggestions?|to\s+serve|serve\s+with|equipment|tools|substitutions?|faqs?)$/i,
  ],
  [
    "macros",
    /^(?:estimated\s+|approx(?:imate|\.)?\s+)?(?:macros?|macronutrients|nutrition(?:al)?(?:\s+(?:facts|info(?:rmation)?|breakdown|values|estimates?|summary))?|calories\s*(?:&|and)\s*macros|macros?\s*(?:&|and)\s*calories|per\s+serving)(?:\s+(per\s+\w+.*|for\b.*))?$/i,
  ],
  ["description", /^(?:description|about(?:\s+this\s+(?:recipe|dish))?|overview|introduction|intro|summary)$/i],
];

/** Generic notes headings add nothing to the notes text; specific ones ("Storage") are kept as a line. */
const GENERIC_NOTES = /^(?:notes?|tips?|notes?\s*(?:&|and)\s*tips?|tips?\s*(?:&|and)\s*(?:notes?|tricks)|(?:chef|cook)'?s?\s+(?:notes?|tips?)|recipe\s+notes|pro\s+tips?)$/i;

export interface SectionMatch {
  kind: SectionKind;
  /** Bracketed or dashed extra: "Macros (per serving)" → "per serving"; "Ingredients (serves 4)" → "serves 4". */
  qualifier: string;
  /** Trailing "for …" words: "Ingredients for the marinade" → "for the marinade". */
  detail: string;
}

/** Maps heading wording to a section; null for anything else ("For the marinade", "Dum"). */
export function classifySection(headingText: string): SectionMatch | null {
  let text = headingText.trim().replace(/[:：]\s*$/, "").trim();
  if (!text || text.length > 80) return null;
  let qualifier = "";
  const paren = /\s*\(([^()]*)\)\s*$/.exec(text);
  if (paren) {
    qualifier = paren[1].trim();
    text = text.slice(0, paren.index).trim();
  } else {
    const dashed = /\s+[-–—|·]\s+(.+)$/.exec(text) ?? /,\s+(.+)$/.exec(text);
    if (dashed) {
      qualifier = dashed[1].trim();
      text = text.slice(0, dashed.index).trim();
    }
  }
  for (const [kind, pattern] of SECTION_PATTERNS) {
    const m = pattern.exec(text);
    if (m) return { kind, qualifier, detail: m[1]?.trim() ?? "" };
  }
  return null;
}

export function isGenericNotesHeading(text: string): boolean {
  return GENERIC_NOTES.test(text.trim().replace(/[:：]\s*$/, ""));
}

/** "for the marinade" → "For the marinade". */
export function groupFromQualifier(qualifier: string): string {
  return capitalize(qualifier.replace(/^[-–—:,\s]+|[:\s]+$/g, ""));
}

export interface HeadingLine {
  /** 1–6 for ATX/setext headings; 7 for bold-only or plain-text section lines. */
  level: number;
  /** Heading text with the Markdown syntax removed but escapes intact. */
  raw: string;
  style: "atx" | "setext" | "bold" | "plain";
  /** Lines consumed (2 for a setext heading). */
  span: number;
  escaped: boolean;
}

const ATX = /^(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const BOLD_ONLY = /^(?:\*\*|__)(?!\s)([^*_]+?)(?<!\s)(?:\*\*|__)\s*:?\s*$/;
const SETEXT_H1 = /^=+$/;
const SETEXT_H2 = /^-{2,}$/;

/** "**For the rice:**" → "For the rice:"; null unless the whole line is bold. */
export function boldOnlyText(text: string): string | null {
  return BOLD_ONLY.exec(stripEmoji(text).trim())?.[1].trim() ?? null;
}

export function isRule(text: string): boolean {
  return /^(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,}|(?:=\s*){3,})$/.test(text);
}

/**
 * Detects a heading at `lines[index]` (each entry is a trimmed line). Bold-only lines and
 * plain-text lines that name a section ("Ingredients", "METHOD:") count as headings too.
 */
export function detectHeading(lines: readonly string[], index: number): HeadingLine | null {
  const text = lines[index];
  if (!text) return null;
  const atx = ATX.exec(text);
  if (atx) {
    const raw = (atx[2] ?? "").trim();
    return { level: atx[1].length, raw, style: "atx", span: 1, escaped: startsEscaped(raw) };
  }
  if (startsEscaped(text)) return null;

  const next = lines[index + 1] ?? "";
  const isListItem = stripListMarker(text).marker !== null;
  if (
    next &&
    !isListItem &&
    !text.startsWith("|") &&
    text.length <= 80 &&
    (SETEXT_H1.test(next) || (SETEXT_H2.test(next) && !/[.!?,;]$/.test(text)))
  ) {
    return { level: SETEXT_H1.test(next) ? 1 : 2, raw: text, style: "setext", span: 2, escaped: false };
  }

  const bare = stripEmoji(text).trim();
  const bold = BOLD_ONLY.exec(bare);
  if (bold) return { level: 7, raw: bold[1].trim(), style: "bold", span: 1, escaped: false };

  if (!isListItem && bare.length <= 80 && classifySection(cleanHeadingText(bare))) {
    return { level: 7, raw: bare, style: "plain", span: 1, escaped: false };
  }
  return null;
}
