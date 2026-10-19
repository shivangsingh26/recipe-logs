// Guesses for text without clear structure: does a line read like an ingredient, an
// instruction, a chat assistant's small talk, a bare link or a table row?

import { cleanInline, stripListMarker, wordCount } from "./text";

const FRACTION = "¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚";
const QUANTITY_START = new RegExp(`^(?:\\d|[${FRACTION}])`);
const WORD_QUANTITY =
  /^(?:(?:a|an)\s+(?:pinch|handful|few|couple|dash|splash|sprig|bunch|knob|squeeze|drizzle|little)|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half|pinch|handful|dash|few|some|small|medium|large|big|fresh|juice|zest)\b/i;
const UNIT_AMOUNT = new RegExp(
  `(?:\\d|[${FRACTION}])\\s*(?:g|gm|kg|mg|ml|l|cl|dl|tbsp|tsp|tbs|tablespoons?|teaspoons?|cups?|oz|ounces?|lbs?|pounds?|cloves?|pcs?|pieces?|pinch(?:es)?|sprigs?|stalks?|slices?|cans?|tins?|bunch(?:es)?|inch(?:es)?|cm)\\b`,
  "i",
);
const NO_QUANTITY_INGREDIENT = /\b(?:to taste|as needed|as required|for garnish|to garnish|for serving|to serve|optional)\)?\.?$/i;

const IMPERATIVE =
  /^(?:add|adjust|air[- ]?fry|arrange|bake|baste|beat|blanch|blend|boil|braise|bring|broil|brown|brush|check|chill|chop|coat|combine|cook|cool|cover|crack|cream|crush|cut|deglaze|dice|dip|discard|dissolve|divide|drain|drizzle|dry[- ]roast|dust|fill|finish|flip|fold|fry|garnish|grate|grease|grill|grind|heat|keep|knead|ladle|layer|leave|let|line|marinate|mash|measure|melt|microwave|mince|mix|open|pat|peel|place|poach|pour|preheat|prepare|press|pressure[- ]cook|pulse|purée|puree|put|reduce|refrigerate|reheat|remove|repeat|rest|return|rinse|roast|roll|rub|sauté|saute|scatter|score|scrape|sear|season|seal|serve|set|shake|shape|shred|sift|simmer|skim|slice|soak|spoon|spread|sprinkle|squeeze|steam|stir|strain|stuff|switch|take|taste|temper|thread|toast|top|toss|transfer|trim|turn|wait|warm|wash|whisk|wipe|wrap)\b/i;

/** Quantity-led or unit-bearing short lines: "750 g chicken", "a pinch of salt", "Salt to taste". */
export function looksLikeIngredient(text: string): boolean {
  const t = cleanInline(stripListMarker(text).text);
  if (!t || t.length > 140 || looksLikeInstruction(t)) return false;
  if (QUANTITY_START.test(t)) return wordCount(t) <= 16;
  if (WORD_QUANTITY.test(t)) return wordCount(t) <= 8 && !/[.!?]$/.test(t);
  if (UNIT_AMOUNT.test(t)) return wordCount(t) <= 12;
  return NO_QUANTITY_INGREDIENT.test(t) && wordCount(t) <= 8;
}

/** Imperative sentences: "Heat the oil in a kadai.", "**Sear:** Add the chicken…". */
export function looksLikeInstruction(text: string): boolean {
  const t = cleanInline(stripListMarker(text).text).replace(/^[^:]{1,40}:\s+(?=\S)/, (label) =>
    wordCount(label) <= 5 ? "" : label,
  );
  return IMPERATIVE.test(t) && (t.length >= 25 || /[.!]$/.test(t));
}

const PREAMBLE =
  /^(?:sure|absolutely|certainly|of course|great(?:\s+(?:choice|question|idea))?|okay|ok|alright|here(?:'s|\s+is|\s+are)|below\s+is|i(?:'ve|\s+have)\s+(?:put together|created|made|written)|this\s+is\s+(?:a|an|my))\b/i;
const SIGN_OFF =
  /^(?:let\s+me\s+know\b|would\s+you\s+like\b|do\s+you\s+want\b|want\s+me\s+to\b|i\s+can\s+also\b|if\s+you(?:'d|\s+would)?\s+(?:like|want)\b.*\b(?:i\s+can|i\s+could|let\s+me)\b|hope\s+you\s+enjoy\b|happy\s+cooking\b|bon\s+app[eé]tit\b|enjoy(?:\s+your\s+[^.!?]{1,30})?\s*[!.]*$)/i;

/** A chat assistant's opener before the recipe ("Sure! Here's a recipe…:"). */
export function isPreamble(text: string): boolean {
  const t = cleanInline(text);
  return t.length <= 200 && PREAMBLE.test(t) && /[:!.]$/.test(t.replace(/[\s\p{Extended_Pictographic}️]+$/u, ""));
}

/** Closing small talk ("Enjoy!", "Let me know if you want a vegetarian version."). */
export function isSignOff(text: string): boolean {
  const t = cleanInline(text).replace(/[\s\p{Extended_Pictographic}️]+$/u, "");
  return t.length > 0 && t.length <= 200 && SIGN_OFF.test(t);
}

export function isBareUrl(text: string): boolean {
  return /^<?(?:https?:\/\/|www\.)\S+>?$/i.test(text.trim());
}

const SEPARATOR_CELL = /^:?-{2,}:?$/;

export function isTableSeparator(text: string): boolean {
  const cells = splitTableRow(text);
  return cells.length > 0 && cells.every((c) => SEPARATOR_CELL.test(c.replace(/\s+/g, "")));
}

/** "| a | b \| c |" → ["a", "b \| c"] (escaped pipes stay inside a cell). */
export function splitTableRow(text: string): string[] {
  const t = text.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return t.split(/(?<!\\)\|/).map((c) => c.trim());
}

/** Number of lines (from `index`) that form a Markdown table, or 0. */
export function tableSpan(lines: readonly string[], index: number): number {
  const first = lines[index] ?? "";
  if (!first.includes("|")) return 0;
  const startsWithPipe = first.startsWith("|") && /(?<!\\)\|.*(?<!\\)\|/.test(first);
  const hasSeparator = isTableSeparator(lines[index + 1] ?? "") && splitTableRow(first).length > 1;
  if (!startsWithPipe && !hasSeparator) return 0;
  let end = index + 1;
  while (end < lines.length && lines[end].includes("|") && (lines[end].startsWith("|") || hasSeparator)) end++;
  return end - index;
}
