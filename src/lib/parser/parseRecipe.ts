// Quick-Import: turns pasted recipe text — ChatGPT/Claude Markdown, recipe-site copy, a terse
// note — into a RecipeDraft plus human-friendly warnings. Pure, synchronous and forgiving:
// any input yields a valid draft.

import { canonicalizeCategories, DEFAULT_CATEGORIES, suggestCategories } from "@/lib/categories";
import { normalizeRecipeDraft } from "@/lib/db/normalize";
import type { Macros, RecipeDraft } from "@/lib/types";
import {
  isBareUrl,
  isPreamble,
  isSignOff,
  isTableSeparator,
  looksLikeIngredient,
  looksLikeInstruction,
  splitTableRow,
  tableSpan,
} from "./heuristics";
import { unwrapAssistantReply } from "./assistant";
import { macroScope, parseMacroTable, scanMacros, type MacroScope, type MacroValues } from "./macros";
import { parseMetadataLine, servingsFromPhrase, type MetadataLine, type MetaPatch } from "./metadata";
import {
  boldOnlyText,
  classifySection,
  detectHeading,
  groupFromQualifier,
  isGenericNotesHeading,
  isRule,
  type HeadingLine,
  type SectionKind,
  type SectionMatch,
} from "./sections";
import { isTitleOnly, StepCollector } from "./steps";
import {
  cleanHeadingText,
  cleanInline,
  cleanStepInline,
  firstLinkUrl,
  normalizeText,
  startsEscaped,
  stripEmoji,
  stripEmphasis,
  stripListMarker,
  stripStepPrefix,
  wordCount,
  type ListItem,
} from "./text";

export interface ParseResult {
  draft: RecipeDraft;
  warnings: string[];
}

export const PARSE_WARNINGS = {
  empty: "Nothing to import yet — paste a recipe first.",
  noTitle: "No title found — add one before saving.",
  noIngredients: "No ingredients found.",
  noSteps: "No steps found.",
  noHeadings: "No section headings found — please check ingredients and steps.",
  totalOnly: "Only a total time was found — it was saved as the cook time.",
  totalMacrosUnknownServings: "Macros look like whole-recipe totals, but the servings are unknown — please check them.",
} as const;

type State = "preamble" | "description" | "ingredients" | "steps" | "notes" | "macros";

interface Line {
  /** Tabs expanded, blockquote markers and trailing whitespace removed. */
  raw: string;
  text: string;
  indent: number;
  /** Ended with a Markdown hard break (backslash or two spaces). */
  hardBreak: boolean;
}

function toLines(text: string): Line[] {
  return text.split("\n").map((source) => {
    let raw = source.replace(/^\t+/, (tabs) => "    ".repeat(tabs.length)).replace(/\t/g, " ");
    raw = raw.replace(/^ {0,3}(?:> ?)+/, "");
    const hardBreak = /(?<!\\)\\$/.test(raw) || / {2,}$/.test(raw);
    raw = raw.replace(/(?<!\\)\\$/, "").trimEnd();
    const trimmed = raw.trim();
    return { raw, text: trimmed, indent: raw.length - raw.trimStart().length, hardBreak: hardBreak && trimmed !== "" };
  });
}

const LINK_ONLY = /^(?:[-*•+]\s+)?\[[^\]\n]*\]\(\s*<?[^)\s>]+>?\s*\)$/;

/** "Ingredients: chicken, salt" / "Method: …" / "Note: …" — a section name with content on the same line. */
function inlineSection(text: string): { kind: "ingredients" | "steps" | "notes"; rest: string } | null {
  if (startsEscaped(text)) return null;
  const m = /^([^:\d]{2,40}?)\s*:\s+(\S.*)$/.exec(stripEmoji(stripEmphasis(text)).trim());
  if (!m) return null;
  const kind = classifySection(cleanHeadingText(m[1]))?.kind;
  return kind === "ingredients" || kind === "steps" || kind === "notes" ? { kind, rest: m[2].trim() } : null;
}

/** "1. Marinate the chicken" / "Step 1: Marinate" as a heading → the step title (may be ""). */
function stepHeadingTitle(text: string): string | null {
  const numbered = /^\d{1,3}\s*[.):\-–—]\s*(.*)$/.exec(text);
  if (numbered) return cleanHeadingText(numbered[1]);
  const step = stripStepPrefix(text);
  return step.matched ? cleanHeadingText(step.text) : null;
}

function isGroupLabel(plain: string): boolean {
  return /:$/.test(plain) && !/[\d¼½¾⅓⅔⅛⅜⅝⅞]/.test(plain) && wordCount(plain) <= 6;
}

function titleFrom(raw: string): string {
  const clean = cleanHeadingText(raw);
  if (startsEscaped(raw.trim())) return clean;
  return clean.replace(/^(?:recipe|title|dish|name)\s*[:\-–—]\s*/i, "").trim();
}

function isTitleLike(text: string): boolean {
  const item = stripListMarker(text);
  if (item.marker || startsEscaped(text)) return false;
  const plain = cleanInline(stripEmoji(text));
  return (
    plain.length > 0 &&
    plain.length <= 120 &&
    !/[.:;,]$/.test(plain) &&
    !looksLikeIngredient(text) &&
    !looksLikeInstruction(text) &&
    !stripStepPrefix(plain).matched
  );
}

function hasValues(values: MacroValues): boolean {
  return Object.keys(values).length > 0;
}

function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

class RecipeTextParser {
  private readonly lines: Line[];
  private readonly trimmed: string[];
  private readonly hasIngredientsHeading: boolean;
  private readonly hasStepsHeading: boolean;

  private state: State = "preamble";
  private sectionLevel = 7;
  private blankBefore = false;
  private title = "";
  private readonly description: string[] = [];
  private readonly ingredients: Array<{ text: string; group?: string }> = [];
  private ingredientGroup: string | undefined;
  private readonly steps = new StepCollector();
  private readonly notes: string[] = [];
  private readonly meta: MetaPatch = {};
  private readonly categories: string[] = [];
  private readonly macros: Record<MacroScope | "unscoped", MacroValues> = { serving: {}, total: {}, unscoped: {} };
  private macroSectionScope: MacroScope | null = null;

  constructor(text: string) {
    this.lines = toLines(normalizeText(text));
    this.trimmed = this.lines.map((l) => l.text);
    let ingredients = false;
    let steps = false;
    for (let i = 0; i < this.lines.length; i++) {
      const heading = detectHeading(this.trimmed, i);
      const kind =
        heading && !heading.escaped
          ? classifySection(cleanHeadingText(heading.raw))?.kind
          : inlineSection(this.trimmed[i])?.kind;
      if (kind === "ingredients") ingredients = true;
      if (kind === "steps") steps = true;
    }
    this.hasIngredientsHeading = ingredients;
    this.hasStepsHeading = steps;
  }

  run(): ParseResult {
    const title = this.findTitle();
    if (title) this.title = title.text;
    else this.state = "description";
    for (let i = 0; i < this.lines.length; i++) {
      if (title && i === title.index) {
        this.state = "description";
        this.blankBefore = false;
        i += title.span - 1;
        continue;
      }
      i = this.processLine(i);
    }
    this.steps.close();
    return this.finish();
  }

  // ── Title ────────────────────────────────────────────────────────────────

  /** First heading (any level) or first title-like line, ignoring chat preambles and metadata. */
  private findTitle(): { index: number; span: number; text: string } | null {
    let firstLine: { index: number; text: string } | null = null;
    let sawContent = false;
    for (let i = 0; i < this.lines.length; i++) {
      const text = this.trimmed[i];
      if (!text || isRule(text)) continue;
      const table = tableSpan(this.trimmed, i);
      if (table) {
        sawContent = true;
        i += table - 1;
        continue;
      }
      const heading = detectHeading(this.trimmed, i);
      if (heading) {
        if (!heading.escaped && classifySection(cleanHeadingText(heading.raw))) break;
        if (!heading.escaped && (parseMetadataLine(heading.raw) || scanMacros(heading.raw).pure)) {
          i += heading.span - 1;
          continue;
        }
        const candidate = titleFrom(heading.raw);
        if (!candidate) continue;
        if (!sawContent || heading.level === 1 || (heading.level === 2 && !firstLine)) {
          return { index: i, span: heading.span, text: candidate };
        }
        break;
      }
      if (parseMetadataLine(text) || scanMacros(text).pure || isPreamble(text) || isSignOff(text) || isBareUrl(text)) {
        continue;
      }
      if (inlineSection(text)) break;
      if (!sawContent && isTitleLike(text)) firstLine = { index: i, text: titleFrom(text) };
      sawContent = true;
    }
    return firstLine && firstLine.text ? { index: firstLine.index, span: 1, text: firstLine.text } : null;
  }

  // ── Line dispatch ────────────────────────────────────────────────────────

  private processLine(index: number): number {
    const line = this.lines[index];
    if (!line.text) {
      this.blankBefore = true;
      return index;
    }
    const open = this.steps.current;
    if (this.state === "steps" && open && open.kind !== "plain" && line.indent >= 2 && line.indent > open.markerIndent) {
      this.stepContinuation(line);
      this.blankBefore = false;
      return index;
    }
    if (isRule(line.text)) {
      this.blankBefore = true;
      return index;
    }
    const span = tableSpan(this.trimmed, index);
    if (span) {
      this.table(index, span);
      this.blankBefore = false;
      return index + span - 1;
    }
    const item = stripListMarker(line.text);
    const escaped = startsEscaped(item.text);
    if (!escaped) {
      const heading = detectHeading(this.trimmed, index);
      if (heading) {
        this.heading(heading, index);
        this.blankBefore = false;
        return index + heading.span - 1;
      }
      if (this.special(line, item)) {
        this.blankBefore = false;
        return index;
      }
    }
    this.content(line, item, escaped);
    this.blankBefore = false;
    return index;
  }

  /** Metadata, macros, inline section labels, links and chat small talk. True when consumed. */
  private special(line: Line, item: ListItem): boolean {
    const text = line.text;
    const inline = inlineSection(text);
    if (inline) {
      if (inline.kind === "notes") {
        this.pushNote(inline.rest);
      } else {
        this.enterSection(inline.kind, 7, null, "");
        this.inlineContent(inline.kind, inline.rest, line);
      }
      return true;
    }

    const meta = item.marker === "number" ? null : parseMetadataLine(text);
    if (meta && this.acceptsMeta(meta, item)) {
      this.applyMeta(meta.patch);
      if (meta.rest) this.addLoose(meta.rest, line);
      return true;
    }

    const scan = scanMacros(text);
    if (scan.count > 0 && this.acceptsMacros(scan.count, scan.pure, scan.labelled, item)) {
      this.addMacros(scan.values, scan.scope ?? (this.state === "macros" ? this.macroSectionScope : null));
      return true;
    }
    if (this.state === "macros" && scan.count === 0 && !/\d/.test(text) && macroScope(text) && wordCount(text) <= 6) {
      this.macroSectionScope = macroScope(text);
      return true;
    }

    if (isBareUrl(item.text) || LINK_ONLY.test(text)) {
      const url = firstLinkUrl(text) ?? item.text.replace(/^<|>$/g, "");
      if (!this.meta.source) this.meta.source = url;
      else this.pushNote(url);
      return true;
    }

    if (isSignOff(text)) return true;
    return this.state === "preamble" && isPreamble(text);
  }

  private acceptsMeta(meta: MetadataLine, item: ListItem): boolean {
    switch (this.state) {
      case "preamble":
      case "description":
        return true;
      case "notes":
        return !meta.rest && item.marker === null;
      default:
        return !meta.rest;
    }
  }

  private acceptsMacros(count: number, pure: boolean, labelled: boolean, item: ListItem): boolean {
    if (this.state === "macros") return true;
    if (item.marker === "number" || !pure) return false;
    if (this.state === "ingredients" || this.state === "steps") return count >= 2;
    return count >= 2 || labelled;
  }

  // ── Headings ─────────────────────────────────────────────────────────────

  private heading(heading: HeadingLine, index: number): void {
    const text = cleanHeadingText(heading.raw);
    if (heading.escaped) {
      this.unknownHeading(text, heading, index, true);
      return;
    }
    if (!text) {
      // An empty "###" ends the current sub-group.
      if (this.state === "ingredients") this.ingredientGroup = undefined;
      if (this.state === "steps") {
        this.steps.close();
        this.steps.group = undefined;
      }
      return;
    }
    const section = classifySection(text);
    if (section) {
      const sameList = section.kind === this.state && (section.kind === "ingredients" || section.kind === "steps");
      if (sameList && heading.level > this.sectionLevel) this.setGroup(text);
      else this.enterSection(section.kind, heading.level, section, text);
      return;
    }
    const meta = parseMetadataLine(heading.raw);
    if (meta && !meta.rest) {
      this.applyMeta(meta.patch);
      return;
    }
    const scan = scanMacros(heading.raw);
    if (scan.pure) {
      this.addMacros(scan.values, scan.scope ?? (this.state === "macros" ? this.macroSectionScope : null));
      return;
    }
    this.unknownHeading(text, heading, index, false);
  }

  private unknownHeading(text: string, heading: HeadingLine, index: number, escaped: boolean): void {
    // Checked on the raw text so an escaped "1\. First" stays a group name.
    const stepTitle = escaped ? null : stepHeadingTitle(stripEmoji(stripEmphasis(heading.raw)).trim());
    switch (this.state) {
      case "ingredients":
        if (stepTitle != null && !this.hasStepsHeading) {
          this.state = "steps";
          this.openTitledStep(stepTitle, false);
        } else {
          this.ingredientGroup = text;
        }
        return;
      case "steps":
        if (stepTitle != null) {
          this.openTitledStep(stepTitle, heading.style === "bold");
        } else if (heading.style === "bold" && !escaped && !this.nextIsListItem(index)) {
          this.openTitledStep(boldOnlyText(this.trimmed[index]) ?? text, true);
        } else {
          this.setGroup(text);
        }
        return;
      case "notes":
        this.addNoteHeading(text);
        return;
      case "macros":
        this.state = "notes";
        this.addNoteHeading(text);
        return;
      default: {
        const next = this.nextContentLine(index + heading.span - 1);
        if (!this.hasIngredientsHeading && next && looksLikeIngredient(next)) {
          this.state = "ingredients";
          this.ingredientGroup = text;
        } else {
          this.pushDescription(/[.:!?]$/.test(text) ? text : `${text}:`);
        }
      }
    }
  }

  private setGroup(text: string): void {
    if (this.state === "ingredients") this.ingredientGroup = text;
    if (this.state === "steps") {
      this.steps.close();
      this.steps.group = text;
    }
  }

  private enterSection(kind: SectionKind, level: number, match: SectionMatch | null, text: string): void {
    if (this.state === "steps" && kind !== "steps") this.steps.close();
    if (kind === "description") {
      this.state = "description";
      return;
    }
    this.state = kind;
    this.sectionLevel = level;
    const qualifier = match?.qualifier ?? "";
    const detail = match?.detail ?? "";
    const detailServings = detail ? servingsFromPhrase(detail) : null;
    const qualifierServings = qualifier ? servingsFromPhrase(qualifier) : null;
    const servings = detailServings ?? qualifierServings;
    if (servings != null && this.meta.servings == null) this.meta.servings = servings;

    if (kind === "ingredients" || kind === "steps") {
      const groupSource =
        detail && detailServings == null
          ? detail
          : qualifier && qualifierServings == null && !macroScope(qualifier) && !/^\d/.test(qualifier)
            ? qualifier
            : "";
      const group = groupSource ? groupFromQualifier(groupSource) : undefined;
      if (kind === "ingredients") this.ingredientGroup = group;
      else {
        this.steps.close();
        this.steps.group = group;
      }
    }
    if (kind === "notes" && text && !isGenericNotesHeading(text)) this.addNoteHeading(text);
    if (kind === "macros") this.macroSectionScope = macroScope(text);
  }

  private nextContentLine(index: number): string | null {
    for (let j = index + 1; j < this.lines.length; j++) if (this.trimmed[j]) return this.trimmed[j];
    return null;
  }

  private nextIsListItem(index: number): boolean {
    const next = this.nextContentLine(index);
    return next != null && stripListMarker(next).marker !== null;
  }

  // ── Content ──────────────────────────────────────────────────────────────

  private content(line: Line, item: ListItem, escaped: boolean): void {
    switch (this.state) {
      case "preamble":
        this.addDescriptionLine(line, item);
        return;
      case "description":
        if (!escaped && !this.hasIngredientsHeading && this.isIngredientLine(line, item)) {
          this.state = "ingredients";
          this.ingredient(item, escaped);
        } else if (!escaped && !this.hasStepsHeading && this.isStepLine(line, item)) {
          this.state = "steps";
          this.step(line, item, escaped);
        } else {
          this.addDescriptionLine(line, item);
        }
        return;
      case "ingredients":
        if (!escaped && !this.hasStepsHeading && this.startsImplicitSteps(line, item)) {
          this.state = "steps";
          this.step(line, item, escaped);
        } else {
          this.ingredient(item, escaped);
        }
        return;
      case "steps":
        this.step(line, item, escaped);
        return;
      default:
        this.addNoteLine(line, item);
    }
  }

  private isIngredientLine(line: Line, item: ListItem): boolean {
    if (item.marker === "bullet") return !looksLikeInstruction(item.text);
    return looksLikeIngredient(line.text);
  }

  private isStepLine(line: Line, item: ListItem): boolean {
    return item.marker === "number" || stripStepPrefix(item.text).matched || looksLikeInstruction(line.text);
  }

  private startsImplicitSteps(line: Line, item: ListItem): boolean {
    if (item.marker === "bullet") return false;
    if (stripStepPrefix(item.text).matched) return true;
    if (item.marker === "number") return looksLikeInstruction(item.text);
    return looksLikeInstruction(line.text) && !looksLikeIngredient(line.text);
  }

  private ingredient(item: ListItem, escaped: boolean): void {
    const body = item.text.trim();
    if (!body) return;
    if (!escaped) {
      const bold = boldOnlyText(body);
      if (bold != null) {
        this.ingredientGroup = cleanHeadingText(bold) || undefined;
        return;
      }
      const plain = cleanInline(body);
      if (isGroupLabel(plain)) {
        this.ingredientGroup = plain.replace(/\s*:$/, "");
        return;
      }
    }
    const text = cleanInline(body);
    if (text) this.ingredients.push(this.ingredientGroup ? { text, group: this.ingredientGroup } : { text });
  }

  private openTitledStep(title: string, bold: boolean): void {
    this.steps.open("titled", "", {
      title: title || null,
      titleBold: bold,
      markerIndent: -1,
      contentIndent: 1000,
    });
  }

  private step(line: Line, item: ListItem, escaped: boolean): void {
    const steps = this.steps;
    const current = steps.current;
    const blank = this.blankBefore;

    // An escape after the marker ("2. \Step 3: …") keeps the text literal, not the marker.
    const listText = escaped ? item.text : stripStepPrefix(item.text).text;
    if (item.marker === "number") {
      steps.open("list", cleanStepInline(listText), {
        markerIndent: line.indent,
        contentIndent: line.indent + item.width,
        numbered: true,
        lastHardBreak: line.hardBreak,
      });
      return;
    }
    if (item.marker === "bullet") {
      if (current && (current.kind === "titled" || (current.kind === "list" && current.numbered))) {
        steps.append(`- ${cleanStepInline(item.text)}`, current.body ? "\n" : "", line.hardBreak);
        return;
      }
      steps.open("list", cleanStepInline(listText), {
        markerIndent: line.indent,
        contentIndent: line.indent + item.width,
        lastHardBreak: line.hardBreak,
      });
      return;
    }
    if (!escaped) {
      const prefixed = stripStepPrefix(item.text);
      if (prefixed.matched) {
        const rest = prefixed.text;
        if (!rest || (wordCount(rest) <= 8 && !/[.!?]$/.test(rest))) {
          this.openTitledStep(rest ? cleanHeadingText(rest) : "", false);
        } else {
          steps.open("list", cleanStepInline(rest), {
            markerIndent: line.indent,
            contentIndent: line.indent,
            numbered: true,
            lastHardBreak: line.hardBreak,
          });
        }
        return;
      }
    }

    const text = cleanStepInline(item.marker ? item.text : line.text.trim());
    if (current) {
      if (current.kind === "titled") {
        steps.append(text, !current.body ? "" : blank ? "\n\n" : "\n", line.hardBreak);
        return;
      }
      if (current.kind === "list" && (!blank || isTitleOnly(current.body))) {
        const joiner = current.lastHardBreak ? "\n" : isTitleOnly(current.body) ? " " : "\n";
        steps.append(text, joiner, line.hardBreak);
        return;
      }
      if (
        current.kind === "plain" &&
        !blank &&
        !current.lastHardBreak &&
        !/[.!?:;)"]$/.test(current.body) &&
        /^[a-z(]/.test(text)
      ) {
        steps.append(text, " ", line.hardBreak);
        return;
      }
    }
    steps.open("plain", text, { lastHardBreak: line.hardBreak });
  }

  /** Indented line under a numbered/titled step: nested bullets, wrapped text, extra paragraphs. */
  private stepContinuation(line: Line): void {
    const step = this.steps.current;
    if (!step) return;
    const content = line.raw.slice(Math.min(line.indent, step.contentIndent)).replace(/^(\s*)[*+•]\s+/, "$1- ");
    const text = cleanStepInline(content);
    const nested = /^\s*(?:-|\d+[.)])\s/.test(content);
    let joiner = "\n";
    if (!step.body) joiner = "";
    else if (this.blankBefore) joiner = "\n\n";
    else if (!step.lastHardBreak && !nested && (isTitleOnly(step.body) || step.kind === "titled")) {
      joiner = isTitleOnly(step.body) ? " " : "\n";
    }
    this.steps.append(text, joiner, line.hardBreak);
  }

  private inlineContent(kind: "ingredients" | "steps", rest: string, line: Line): void {
    if (kind === "steps") {
      this.steps.open("plain", cleanStepInline(rest), { lastHardBreak: line.hardBreak });
      return;
    }
    const parts = rest.includes(";")
      ? rest.split(/\s*;\s*/)
      : (rest.match(/,/g)?.length ?? 0) >= 2 && rest.split(/\s*,\s*/).every((p) => wordCount(p) <= 5)
        ? rest.split(/\s*,\s*/)
        : [rest];
    for (const part of parts) {
      const text = cleanInline(part).replace(/[.]$/, "");
      if (text) this.ingredients.push(this.ingredientGroup ? { text, group: this.ingredientGroup } : { text });
    }
  }

  private table(index: number, span: number): void {
    const rows = this.trimmed
      .slice(index, index + span)
      .filter((row) => !isTableSeparator(row))
      .map(splitTableRow);
    const macros = parseMacroTable(rows, this.state === "macros" ? 1 : 2);
    if (macros) {
      this.addMacros(macros.values, macros.scope ?? (this.state === "macros" ? this.macroSectionScope : null));
      return;
    }
    const header = rows[0]?.map((cell) => cleanInline(cell).toLowerCase()) ?? [];
    const amountCol = header.findIndex((h) => /^(?:amount|quantity|qty|measure|how much)/.test(h));
    const nameCol = header.findIndex((h) => /^(?:ingredients?|items?|what)/.test(h));
    const hasHeader = amountCol >= 0 || nameCol >= 0 || header.some((h) => /^(?:notes?|step|time|description)$/.test(h));
    const body = hasHeader ? rows.slice(1) : rows;
    for (const row of body) {
      const cells = row.map((cell) => cleanInline(cell));
      let text: string;
      if (this.state === "ingredients" && amountCol >= 0 && nameCol >= 0) {
        const extra = cells.filter((_, i) => i !== amountCol && i !== nameCol && cells[i]);
        text = [`${cells[amountCol] ?? ""} ${cells[nameCol] ?? ""}`.trim(), ...extra].filter(Boolean).join(", ");
      } else {
        text = cells.filter(Boolean).join(this.state === "ingredients" ? " " : " — ");
      }
      if (text) this.addLoose(text, this.lines[index]);
    }
  }

  // ── Sinks ────────────────────────────────────────────────────────────────

  /** Text that is not a heading/list item in its own right (metadata leftovers, table rows). */
  private addLoose(text: string, line: Line): void {
    switch (this.state) {
      case "ingredients":
        this.ingredients.push(this.ingredientGroup ? { text, group: this.ingredientGroup } : { text });
        return;
      case "steps":
        this.steps.open("plain", text, { lastHardBreak: line.hardBreak });
        return;
      case "notes":
      case "macros":
        this.pushNote(text);
        return;
      default:
        this.pushDescription(text);
    }
  }

  private pushDescription(text: string): void {
    if (this.blankBefore && this.description.length) this.description.push("");
    this.description.push(text);
  }

  private addDescriptionLine(line: Line, item: ListItem): void {
    const text = item.marker === "bullet" ? `- ${cleanInline(item.text)}` : cleanInline(line.text);
    if (text && text !== "-") this.pushDescription(text);
  }

  private pushNote(text: string): void {
    if (this.blankBefore && this.notes.length) this.notes.push("");
    this.notes.push(text);
  }

  private addNoteLine(line: Line, item: ListItem): void {
    const text = item.marker === "bullet" ? `- ${cleanInline(item.text)}` : cleanInline(line.text);
    if (text && text !== "-") this.pushNote(text);
  }

  private addNoteHeading(text: string): void {
    if (this.notes.length && this.notes[this.notes.length - 1] !== "") this.notes.push("");
    this.notes.push(/[.:!?]$/.test(text) ? text : `${text}:`);
  }

  private applyMeta(patch: MetaPatch): void {
    if (patch.prepMinutes != null) this.meta.prepMinutes ??= patch.prepMinutes;
    if (patch.cookMinutes != null) this.meta.cookMinutes ??= patch.cookMinutes;
    if (patch.totalMinutes != null) this.meta.totalMinutes ??= patch.totalMinutes;
    if (patch.servings != null) this.meta.servings ??= patch.servings;
    if (patch.source) this.meta.source ||= patch.source;
    if (patch.categories) this.categories.push(...patch.categories);
    if (patch.description) this.pushDescription(patch.description);
  }

  private addMacros(values: MacroValues, scope: MacroScope | null): void {
    const bucket = this.macros[scope ?? "unscoped"];
    for (const [key, value] of Object.entries(values) as Array<[keyof MacroValues, number]>) {
      bucket[key] ??= value;
    }
  }

  // ── Result ───────────────────────────────────────────────────────────────

  private resolveMacros(servings: number | null, warnings: string[]): Macros {
    const perServing: MacroValues = { ...this.macros.unscoped, ...this.macros.serving };
    let values: MacroValues = perServing;
    if (!hasValues(perServing) && hasValues(this.macros.total)) {
      if (servings && servings > 0) {
        values = Object.fromEntries(
          Object.entries(this.macros.total).map(([k, v]) => [k, v / servings]),
        ) as MacroValues;
        warnings.push(
          `Macros were for the whole recipe — divided by ${servings} ${servings === 1 ? "serving" : "servings"}.`,
        );
      } else {
        values = this.macros.total;
        warnings.push(PARSE_WARNINGS.totalMacrosUnknownServings);
      }
    }
    const calories = values.calories ?? (values.kj != null ? values.kj / 4.184 : undefined);
    return {
      calories: calories != null ? Math.round(calories) : null,
      protein: values.protein != null ? roundTo(values.protein, 1) : null,
      carbs: values.carbs != null ? roundTo(values.carbs, 1) : null,
      fat: values.fat != null ? roundTo(values.fat, 1) : null,
    };
  }

  private finish(): ParseResult {
    const warnings: string[] = [];
    const { totalMinutes } = this.meta;
    let { prepMinutes, cookMinutes } = this.meta;
    let totalOnly = false;
    if (totalMinutes != null) {
      if (prepMinutes != null && cookMinutes == null && totalMinutes > prepMinutes) cookMinutes = totalMinutes - prepMinutes;
      else if (cookMinutes != null && prepMinutes == null && totalMinutes > cookMinutes) {
        prepMinutes = totalMinutes - cookMinutes;
      } else if (prepMinutes == null && cookMinutes == null) {
        cookMinutes = totalMinutes;
        totalOnly = true;
      }
    }
    const servings = this.meta.servings ?? null;
    const macroWarnings: string[] = [];
    const macros = this.resolveMacros(servings, macroWarnings);
    const ingredients = this.ingredients;
    const steps = this.steps.items;

    // Explicit categories win; suggestions only fill in when the text names none.
    const categories = canonicalizeCategories(
      this.categories.length
        ? this.categories
        : suggestCategories({ title: this.title, ingredients, steps, macros, prepMinutes: prepMinutes ?? null, cookMinutes: cookMinutes ?? null }),
      DEFAULT_CATEGORIES,
    );

    const draft = normalizeRecipeDraft({
      title: this.title,
      description: joinBlock(this.description),
      categories,
      prepMinutes: prepMinutes ?? null,
      cookMinutes: cookMinutes ?? null,
      servings,
      macros,
      ingredients,
      steps,
      notes: joinBlock(this.notes),
      source: this.meta.source ?? "",
    });

    if (!this.title) warnings.push(PARSE_WARNINGS.noTitle);
    if (!draft.ingredients.length) warnings.push(PARSE_WARNINGS.noIngredients);
    if (!draft.steps.length) warnings.push(PARSE_WARNINGS.noSteps);
    if (!this.hasIngredientsHeading && !this.hasStepsHeading && (draft.ingredients.length || draft.steps.length)) {
      warnings.push(PARSE_WARNINGS.noHeadings);
    }
    warnings.push(...macroWarnings);
    if (totalOnly) warnings.push(PARSE_WARNINGS.totalOnly);
    return { draft, warnings };
  }
}

/** Lines with "" as paragraph breaks → text with single blank lines, trimmed. */
function joinBlock(lines: readonly string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    if (line === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** Parses pasted recipe text. Never throws; empty input yields an empty draft and a warning. */
export function parseRecipeText(text: string): ParseResult {
  const input = typeof text === "string" ? unwrapAssistantReply(text) : "";
  if (!input.trim()) return { draft: normalizeRecipeDraft({ title: "" }), warnings: [PARSE_WARNINGS.empty] };
  return new RecipeTextParser(input).run();
}
