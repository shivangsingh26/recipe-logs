// The ingredients/steps editor works on a flat list of rows (items and section headings),
// while recipes store items with an optional `group`. These pure helpers convert between the
// two and implement the list edits: insert, remove, move and multi-line paste.

import { newId } from "@/lib/ids";
import type { Macros, RecipeDraft } from "@/lib/types";

export type RowKind = "item" | "heading";

export interface EditorRow {
  /** React key. For items it is also the stored ingredient/step id, which keeps cooking progress. */
  id: string;
  kind: RowKind;
  text: string;
}

/** An ingredient or step as stored (ids are optional in drafts). */
export interface GroupedItem {
  id?: string;
  text: string;
  group?: string;
}

export interface RowItem {
  id: string;
  text: string;
  group?: string;
}

type MakeId = () => string;

/**
 * Items → rows: a heading row is inserted whenever the group changes. Returning to "no group"
 * is written as a blank heading, which `itemsFromRows` reads as the end of the section.
 * Existing item ids are kept (duplicates get a fresh id so React keys stay unique).
 */
export function rowsFromItems(items: readonly GroupedItem[], makeId: MakeId = newId): EditorRow[] {
  // Reserve existing ids up front (first occurrence wins) so generated ids can never collide with them.
  const reserved = new Set<string>();
  const keepsId = items.map((item) => {
    if (!item.id || reserved.has(item.id)) return false;
    reserved.add(item.id);
    return true;
  });
  const fresh = () => {
    let id = makeId();
    while (reserved.has(id)) id = makeId();
    reserved.add(id);
    return id;
  };

  const rows: EditorRow[] = [];
  let current = "";
  items.forEach((item, i) => {
    const group = item.group?.trim() ?? "";
    if (group !== current) {
      rows.push({ id: fresh(), kind: "heading", text: group });
      current = group;
    }
    rows.push({ id: keepsId[i] && item.id ? item.id : fresh(), kind: "item", text: item.text });
  });
  return rows;
}

/** Section name from a heading row: trimmed, without a trailing colon. */
function headingGroup(text: string): string {
  return text.trim().replace(/\s*:+$/, "");
}

/** Rows → items. Each item takes the nearest heading above as its group; blank items are dropped. */
export function itemsFromRows(rows: readonly EditorRow[]): RowItem[] {
  const items: RowItem[] = [];
  let group = "";
  for (const row of rows) {
    if (row.kind === "heading") {
      group = headingGroup(row.text);
      continue;
    }
    const text = row.text.trim();
    if (text) items.push(group ? { id: row.id, text, group } : { id: row.id, text });
  }
  return items;
}

export interface PastedLine {
  kind: RowKind;
  text: string;
}

// "- ", "* ", "• ", "1. ", "2) ", "(3) ", checklist "[ ] " / "[x] "; a bare "•" may hug the text.
const BULLET_RE = /^(?:[-*•·▪◦–—]\s+|•|\d{1,3}[.)]\s+|\(\d{1,3}\)\s+|\[[ xX]?\]\s+)/;
const HAS_WORD_RE = /[A-Za-z0-9À-￿]/;

function stripBullets(line: string): string {
  let text = line.trim();
  // Twice, for list items that are also checkboxes: "- [ ] 2 eggs".
  for (let i = 0; i < 2; i++) text = text.replace(BULLET_RE, "").trim();
  return text;
}

/** "# Rice", "For the marinade:" or "**Dum:**" → the section name; any other line → null. */
function headingName(line: string): string | null {
  const bold = /^\*\*(.+)\*\*$/.exec(line);
  const text = bold ? bold[1].trim() : line;
  if (text.startsWith("#")) return headingGroup(text.replace(/^#+/, ""));
  if (text.endsWith(":")) return headingGroup(text);
  return null;
}

/** Splits pasted text into rows: one per line with words, bullets/numbering stripped, headings detected. */
export function splitPastedText(text: string): PastedLine[] {
  const lines: PastedLine[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const body = stripBullets(raw);
    if (!HAS_WORD_RE.test(body)) continue;
    const heading = headingName(body);
    if (heading === null) lines.push({ kind: "item", text: body });
    else if (heading) lines.push({ kind: "heading", text: heading });
  }
  return lines;
}

export interface TextSelection {
  start: number;
  end: number;
}

export interface PasteResult {
  rows: EditorRow[];
  /** Row to focus afterwards, with the caret at `caret` (just after the pasted text). */
  focusId: string;
  caret: number;
}

/**
 * Pastes multi-line text into row `index` the way a text editor would: the first line joins
 * the text before the selection, the other lines become new rows below, and the text after the
 * selection follows the last pasted line. When the row is empty before the caret, the first
 * line also decides its kind (so a pasted section heading stays a heading).
 * Returns null for single-line text, which the browser should paste normally.
 */
export function applyPaste(
  rows: readonly EditorRow[],
  index: number,
  selection: TextSelection,
  pasted: string,
  makeId: MakeId = newId,
): PasteResult | null {
  const row = rows[index];
  if (!row || !/[\r\n]/.test(pasted.trim())) return null;
  const lines = splitPastedText(pasted);
  if (lines.length === 0) return null;

  const before = row.text.slice(0, selection.start);
  const after = row.text.slice(selection.end);
  const [first, ...rest] = lines;
  const pastedRows: EditorRow[] = [
    before.trim() ? { ...row, text: before + first.text } : { id: row.id, kind: first.kind, text: first.text },
    ...rest.map((line) => ({ id: makeId(), kind: line.kind, text: line.text })),
  ];
  const last = pastedRows[pastedRows.length - 1];
  pastedRows[pastedRows.length - 1] = { ...last, text: last.text + after };
  return {
    rows: [...rows.slice(0, index), ...pastedRows, ...rows.slice(index + 1)],
    focusId: last.id,
    caret: last.text.length,
  };
}

/** Inserts an empty row after `index` (-1 inserts at the top). */
export function insertRow(
  rows: readonly EditorRow[],
  index: number,
  kind: RowKind,
  makeId: MakeId = newId,
): { rows: EditorRow[]; id: string } {
  const row: EditorRow = { id: makeId(), kind, text: "" };
  const at = Math.max(0, Math.min(rows.length, index + 1));
  return { rows: [...rows.slice(0, at), row, ...rows.slice(at)], id: row.id };
}

export function removeRow(rows: readonly EditorRow[], index: number): EditorRow[] {
  return rows.filter((_, i) => i !== index);
}

/** Moves a row one place up (-1) or down (+1); moves past either end leave the order unchanged. */
export function moveRow(rows: readonly EditorRow[], index: number, delta: -1 | 1): EditorRow[] {
  const next = [...rows];
  const target = index + delta;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** 1-based number of each item row (headings get null), as shown beside steps. */
export function itemNumbers(rows: readonly EditorRow[]): Array<number | null> {
  let n = 0;
  return rows.map((row) => (row.kind === "item" ? ++n : null));
}

/** The editor form's state: a draft whose ingredients and steps are editable rows. */
export interface EditorState {
  title: string;
  description: string;
  categories: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  macros: Macros;
  ingredientRows: EditorRow[];
  stepRows: EditorRow[];
  notes: string;
  source: string;
}

/** Draft → form state. Empty lists start with one blank item so there is somewhere to type. */
export function editorStateFromDraft(draft: RecipeDraft, makeId: MakeId = newId): EditorState {
  const rowsOf = (items: readonly GroupedItem[]): EditorRow[] => {
    const rows = rowsFromItems(items, makeId);
    return rows.length > 0 ? rows : [{ id: makeId(), kind: "item", text: "" }];
  };
  return {
    title: draft.title,
    description: draft.description,
    categories: [...draft.categories],
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    servings: draft.servings,
    macros: { ...draft.macros },
    ingredientRows: rowsOf(draft.ingredients),
    stepRows: rowsOf(draft.steps),
    notes: draft.notes,
    source: draft.source,
  };
}

/** Form state → draft for createRecipe / updateRecipe. Existing item ids are kept. */
export function draftFromEditorState(state: EditorState): RecipeDraft {
  return {
    title: state.title.trim(),
    description: state.description.trim(),
    categories: [...state.categories],
    prepMinutes: state.prepMinutes,
    cookMinutes: state.cookMinutes,
    servings: state.servings,
    macros: { ...state.macros },
    ingredients: itemsFromRows(state.ingredientRows),
    steps: itemsFromRows(state.stepRows),
    notes: state.notes.trim(),
    source: state.source.trim(),
  };
}
