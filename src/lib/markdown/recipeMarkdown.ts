// Canonical Markdown for one recipe: readable on its own (backups, sharing) and read back
// losslessly by parseRecipeText(). Free text is escaped only where the parser would otherwise
// misread it; every escape is verified by parsing the line in the same context.

import { normalizeRecipeDraft } from "@/lib/db/normalize";
import { parseRecipeText } from "@/lib/parser/parseRecipe";
import { stripEmphasis, stripItalics, stripLinks } from "@/lib/parser/text";
import type { Macros, Recipe, RecipeDraft } from "@/lib/types";

interface Item {
  text: string;
  group?: string;
}

interface Context {
  hasIngredients: boolean;
  hasSteps: boolean;
}

/** Escapes inline markup the parser would strip or reinterpret. */
function escapeInline(text: string, keepBold = false): string {
  let out = text.replace(/[\\`]/g, "\\$&");
  if (keepBold ? stripItalics(out) !== out : stripEmphasis(out) !== out) {
    out = keepBold ? out.replace(/(?<!\*)\*(?!\*)/g, "\\*").replace(/[_~]/g, "\\$&") : out.replace(/[*_~]/g, "\\$&");
  }
  if (stripLinks(out) !== out) out = out.replace(/[[<]/g, "\\$&");
  if (/<(?:!--|br\b)|!\[/i.test(out)) out = out.replace(/</g, "\\<").replace(/!\[/g, "!\\[");
  return out;
}

/** Makes a line literal: "1. x" → "1\. x", "# x" → "\# x", "Serves 4" → "\Serves 4". */
function escapeLineStart(text: string): string {
  const numbered = /^(\d+)([.)])/.exec(text);
  return numbered ? `${numbered[1]}\\${text.slice(numbered[1].length)}` : `\\${text}`;
}

/** First candidate the parser reads back correctly (the last one otherwise). */
function pick(candidates: readonly string[], readsBack: (candidate: string) => boolean): string {
  for (const candidate of candidates) if (readsBack(candidate)) return candidate;
  return candidates[candidates.length - 1];
}

function sections(ctx: Context): string {
  return `${ctx.hasIngredients ? "\n\n## Ingredients\n- x" : ""}${ctx.hasSteps ? "\n\n## Instructions\n1. x" : ""}`;
}

function titleLine(title: string): string {
  const escaped = escapeInline(title);
  return pick([`# ${escaped}`, `# ${escapeLineStart(escaped)}`], (line) => {
    return parseRecipeText(`${line}\n\n## Ingredients\n- x`).draft.title === title;
  });
}

/** Description or notes text, line by line; blank lines are kept as paragraph breaks. */
function textBlock(text: string, render: (line: string) => string, readBack: (doc: string) => string): string[] {
  return text.split("\n").map((line) => {
    if (!line.trim()) return "";
    const escaped = escapeInline(line);
    return pick([escaped, escapeLineStart(escaped)], (candidate) => readBack(render(candidate)) === line.trim());
  });
}

function metadataLines(r: RecipeDraft): string[] {
  const lines: string[] = [];
  if (r.prepMinutes != null) lines.push(`- **Prep time:** ${r.prepMinutes} min`);
  if (r.cookMinutes != null) lines.push(`- **Cook time:** ${r.cookMinutes} min`);
  if (r.servings != null) lines.push(`- **Servings:** ${r.servings}`);
  if (r.categories.length) {
    const list = r.categories.map((c) => escapeInline(c).replace(/[,·|;/•]/g, "\\$&")).join(", ");
    lines.push(`- **Categories:** ${list}`);
  }
  return lines;
}

const MACRO_COLUMNS: ReadonlyArray<readonly [keyof Macros, string, string]> = [
  ["calories", "Calories", "kcal"],
  ["protein", "Protein", "g"],
  ["carbs", "Carbs", "g"],
  ["fat", "Fat", "g"],
];

function macrosTable(macros: Macros): string[] {
  const columns = MACRO_COLUMNS.filter(([key]) => macros[key] != null);
  if (!columns.length) return [];
  return [
    "## Macros (per serving)",
    `| ${columns.map(([, label]) => label).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    `| ${columns.map(([key, , unit]) => `${macros[key]} ${unit}`).join(" | ")} |`,
  ];
}

function groupLine(group: string, section: "ingredients" | "steps"): string {
  const escaped = escapeInline(group);
  const doc = (line: string) =>
    section === "ingredients" ? `# T\n\n## Ingredients\n${line}\n- x` : `# T\n\n## Instructions\n${line}\n1. x`;
  return pick([`### ${escaped}`, `### ${escapeLineStart(escaped)}`], (line) => {
    const draft = parseRecipeText(doc(line)).draft;
    const first = section === "ingredients" ? draft.ingredients[0] : draft.steps[0];
    return first?.group === group;
  });
}

/** Items under "### group" sub-headings; an empty "###" returns to ungrouped items. */
function groupedLines(items: readonly Item[], section: "ingredients" | "steps", line: (item: Item, n: number) => string[]): string[] {
  const out: string[] = [];
  let group: string | undefined;
  items.forEach((item, index) => {
    if (item.group !== group) {
      if (item.group) out.push(groupLine(item.group, section));
      else out.push("###");
      group = item.group;
    }
    out.push(...line(item, index + 1));
  });
  return out;
}

function ingredientLine(item: Item, ctx: Context): string[] {
  const escaped = escapeInline(item.text);
  const doc = (line: string) => `# T\n\n## Ingredients\n${line}${ctx.hasSteps ? "\n\n## Instructions\n1. x" : ""}`;
  return [
    pick([`- ${escaped}`, `- ${escapeLineStart(escaped)}`], (line) => {
      const [first, ...rest] = parseRecipeText(doc(line)).draft.ingredients;
      return rest.length === 0 && first?.text === item.text && !first.group;
    }),
  ];
}

function stepLines(item: Item, n: number): string[] {
  const marker = `${n}. `;
  const indent = " ".repeat(marker.length);
  const [first = "", ...rest] = item.text.split("\n");
  const body = rest.map((line) => (line.trim() ? indent + escapeInline(line, true) : ""));
  const head = escapeInline(first, true);
  // Trailing backslashes force line breaks when the parser would otherwise join lines with a space.
  const hardBreaks = (lines: string[]) => lines.map((l, i) => (i < lines.length - 1 && l.trim() ? `${l}\\` : l));
  const variants = [
    [marker + head, ...body],
    [marker + escapeLineStart(head), ...body],
    hardBreaks([marker + head, ...body]),
    hardBreaks([marker + escapeLineStart(head), ...body]),
  ];
  const chosen = pick(
    variants.map((v) => v.join("\n")),
    (block) => {
      const steps = parseRecipeText(`# T\n\n## Instructions\n${block}`).draft.steps;
      return steps.length === 1 && steps[0].text === item.text;
    },
  );
  return chosen.split("\n");
}

function sourceLine(source: string): string {
  const escaped = escapeInline(source);
  return pick([`**Source:** ${escaped}`, `**Source:** ${escapeLineStart(escaped)}`], (line) => {
    return parseRecipeText(`# T\n\n## Notes & Tips\n- x\n\n${line}`).draft.source === source;
  });
}

/** Serialises a recipe to the canonical Markdown that parseRecipeText() reads back. */
export function recipeToMarkdown(recipe: Recipe | RecipeDraft): string {
  const r = normalizeRecipeDraft(recipe);
  const ctx: Context = { hasIngredients: r.ingredients.length > 0, hasSteps: r.steps.length > 0 };
  const blocks: string[][] = [[titleLine(r.title)]];

  if (r.description) {
    blocks.push(
      textBlock(
        r.description,
        (line) => `# T\n\n${line}${sections(ctx)}`,
        (doc) => parseRecipeText(doc).draft.description,
      ),
    );
  }
  const meta = metadataLines(r);
  if (meta.length) blocks.push(meta);
  const macros = macrosTable(r.macros);
  if (macros.length) blocks.push(macros);
  if (ctx.hasIngredients) {
    blocks.push(["## Ingredients", ...groupedLines(r.ingredients, "ingredients", (item) => ingredientLine(item, ctx))]);
  }
  if (ctx.hasSteps) blocks.push(["## Instructions", ...groupedLines(r.steps, "steps", stepLines)]);
  if (r.notes) {
    blocks.push([
      "## Notes & Tips",
      ...textBlock(
        r.notes,
        (line) => `# T\n\n## Notes & Tips\n${line}`,
        (doc) => parseRecipeText(doc).draft.notes,
      ),
    ]);
  }
  if (r.source) blocks.push([sourceLine(r.source)]);
  return `${blocks.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}
