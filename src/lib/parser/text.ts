// Low-level text helpers shared by the recipe parser and the Markdown serializer.
// Escapes follow CommonMark (a backslash before ASCII punctuation), plus one extension:
// a backslash at the very start of a line, before a letter or digit, marks the line as
// literal text ("\Serves 4 as a side" is a note, not the servings field).

const ZERO_WIDTH = /[​‌‍⁠﻿­]/g;
const ODD_SPACES = /[  -   　]/g;
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}⃣︎️]/gu;
const ASCII_PUNCT = "!-\\/:-@\\[-`{-~";
const ESCAPED_CHAR = new RegExp(`\\\\([${ASCII_PUNCT}])`, "g");
const LITERAL_MARKER = new RegExp(`^\\\\(?=[^${ASCII_PUNCT}\\s])`);

/** Whole-text clean-up: line endings, invisible characters, smart quotes, comments, images. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/(?<!\\)<!--[\s\S]*?-->/g, "")
    .replace(ZERO_WIDTH, "")
    .replace(ODD_SPACES, " ")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/(?<!\\)<br\s*\/?>/gi, "\n")
    .replace(/(?<!\\)!\[[^\]\n]*\]\([^)\n]*\)/g, "");
}

export function stripEmoji(text: string): string {
  return text.replace(EMOJI, "");
}

/** Removes CommonMark backslash escapes: "1\. Mix" → "1. Mix". */
export function unescapeMarkdown(text: string): string {
  return text.replace(ESCAPED_CHAR, "$1");
}

/** True when a line (after any list marker) starts with an escape, i.e. it must be read as plain text. */
export function startsEscaped(text: string): boolean {
  return text.startsWith("\\");
}

export function removeLiteralMarker(text: string): string {
  return text.replace(LITERAL_MARKER, "");
}

const LINK = /(?<!\\)\[([^\]\n]*)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"\n]*")?\s*\)/g;
const AUTOLINK = /(?<!\\)<((?:https?:\/\/|www\.)[^>\s]+)>/gi;

/** "[Serious Eats](https://…)" → "Serious Eats"; "<https://…>" → "https://…". */
export function stripLinks(text: string): string {
  return text.replace(LINK, (_m, label: string, url: string) => label.trim() || url).replace(AUTOLINK, "$1");
}

/** First Markdown link or autolink target in the text, if any. */
export function firstLinkUrl(text: string): string | null {
  LINK.lastIndex = 0;
  const link = LINK.exec(text);
  LINK.lastIndex = 0;
  if (link?.[2]) return link[2];
  AUTOLINK.lastIndex = 0;
  const auto = AUTOLINK.exec(text);
  AUTOLINK.lastIndex = 0;
  return auto ? auto[1] : null;
}

const BOLD_STARS = /(?<!\\)\*\*(?=\S)([\s\S]*?[^\s\\])\*\*/g;
const BOLD_UNDERSCORES = /(?<![\\\w])__(?=\S)([\s\S]*?[^\s\\])__(?!\w)/g;
const ITALIC_STAR = /(^|[^\w*\\])\*(?=[^\s*])([^*\n]*?[^\s*\\])\*(?![\w*])/g;
const ITALIC_UNDERSCORE = /(^|[^\w\\])_(?=[^\s_])([^_\n]*?[^\s_\\])_(?!\w)/g;
const CODE = /(?<!\\)`+([^`\n]*?)`+/g;
const STRIKE = /(?<!\\)~~(?=\S)([^~\n]*?\S)~~/g;

/** Italic and inline-code markup removed, `**bold**` kept (step text renders bold). */
export function stripItalics(text: string): string {
  return text
    .replace(BOLD_UNDERSCORES, "**$1**")
    .replace(ITALIC_STAR, "$1$2")
    .replace(ITALIC_UNDERSCORE, "$1$2")
    .replace(CODE, "$1")
    .replace(STRIKE, "$1");
}

/** All emphasis/code markup removed, words kept: "**Prep:** `20` _min_" → "Prep: 20 min". */
export function stripEmphasis(text: string): string {
  return stripItalics(text).replace(BOLD_STARS, "$1");
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Plain single-line text: links, emphasis and escapes resolved. */
export function cleanInline(text: string): string {
  return collapseSpaces(unescapeMarkdown(stripEmphasis(stripLinks(removeLiteralMarker(text.trim())))));
}

/** Step text: like cleanInline but keeps `**bold**` and inner spacing of continuation lines. */
export function cleanStepInline(text: string): string {
  return unescapeMarkdown(stripItalics(stripLinks(removeLiteralMarker(text)))).trimEnd();
}

/** Heading text for display/classification: no markup, emoji or trailing colon. */
export function cleanHeadingText(text: string): string {
  if (startsEscaped(text.trim())) return collapseSpaces(unescapeMarkdown(removeLiteralMarker(text.trim())));
  const base = stripEmoji(stripEmphasis(stripLinks(text))).replace(/(?<!\\)[*_`]+/g, " ");
  return collapseSpaces(unescapeMarkdown(base))
    .replace(/\s*[:：]\s*$/, "")
    .trim();
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export type ListMarker = "bullet" | "number" | null;

export interface ListItem {
  marker: ListMarker;
  /** Text after the marker. */
  text: string;
  /** Characters consumed by the marker (incl. trailing spaces). */
  width: number;
}

const BULLET = /^(?:[-*+•▪◦‣⁃–—]\s+|[•▪◦‣](?=\S))/;
const NUMBERED = /^\(?\d{1,3}[.)](?=\s)\s*/;
const CHECKBOX = /^\[(?:\s|x|X)?\]\s*/;

/** Strips one list marker ("- ", "* ", "• ", "1. ", "2) ") and a task checkbox. */
export function stripListMarker(text: string): ListItem {
  const bullet = BULLET.exec(text);
  if (bullet) return withoutCheckbox("bullet", text, bullet[0].length);
  const numbered = NUMBERED.exec(text);
  if (numbered) return withoutCheckbox("number", text, numbered[0].length);
  return withoutCheckbox(null, text, 0);
}

function withoutCheckbox(marker: ListMarker, text: string, width: number): ListItem {
  const rest = text.slice(width);
  const box = CHECKBOX.exec(rest);
  return box ? { marker, text: rest.slice(box[0].length), width: width + box[0].length } : { marker, text: rest, width };
}

export function stripBullet(text: string): string {
  const bullet = BULLET.exec(text);
  const rest = bullet ? text.slice(bullet[0].length) : text;
  return rest.replace(CHECKBOX, "");
}

const STEP_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const STEP_PREFIX = new RegExp(`^(\\*\\*|__)?\\s*step\\s*(?:\\d{1,3}|${STEP_WORDS})\\b\\s*(?:[:.)\\-–—]\\s*)?`, "i");

/** "Step 2: Fry" → "Fry"; "**Step 2:** Fry" → "Fry"; "**Step 2: Fry**" → "**Fry**". */
export function stripStepPrefix(text: string): { text: string; matched: boolean } {
  const m = STEP_PREFIX.exec(text);
  if (!m) return { text, matched: false };
  let rest = text.slice(m[0].length);
  const bold = m[1];
  if (bold) {
    if (rest.startsWith(bold)) rest = rest.slice(bold.length).replace(/^\s*[:.)\-–—]\s*/, "");
    else rest = bold + rest;
  }
  return { text: rest.replace(/\*\*\s*\*\*/g, "").trim(), matched: true };
}
