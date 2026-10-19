// What a Shortcut (or, later, an MCP tool) may post: one recipe as text, usually the canonical
// Markdown the CulinaryLog Gem writes. The relay only checks the shape; the app parses and
// sanitises it again on the phone before anything is saved.

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_TEXT_CHARS = 60_000;
const MAX_TITLE_CHARS = 120;

export type PayloadError = "empty" | "bad_json" | "too_large" | "not_a_recipe";

export type PayloadResult = { ok: true; text: string; title: string } | { ok: false; error: PayloadError };

const LIST_ITEM_RE = /^\s*(?:[-*+•]|\d+[.)])\s+\S/gm;

/** Line endings normalised; control characters other than tab and newline removed. */
function clean(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();
}

function field(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** The recipe text inside a request body, by content type (JSON, form or plain text). */
function extract(contentType: string | null, body: string): string | PayloadError {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type === "application/json" || type.endsWith("+json")) {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return "bad_json";
    }
    const record = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
    return field(record.text) ?? field(record.markdown) ?? "empty";
  }
  if (type === "application/x-www-form-urlencoded") {
    const form = new URLSearchParams(body);
    return form.get("text") ?? form.get("markdown") ?? "empty";
  }
  return body;
}

/** A recipe has an ingredients section and at least two list items. */
export function looksLikeRecipe(text: string): boolean {
  return /\bingredients?\b/i.test(text) && (text.match(LIST_ITEM_RE)?.length ?? 0) >= 2;
}

/** A short name for confirmation messages: the first heading, else the first line. */
export function recipeTitle(text: string): string {
  const lines = text.split("\n").map((line) => line.trim());
  const heading = lines.find((line) => /^#{1,6}\s+\S/.test(line));
  const first = heading ?? lines.find((line) => line && !/^(`{3,}|~{3,})/.test(line)) ?? "";
  return first
    .replace(/^#{1,6}\s+/, "")
    .replace(/[*_`]+/g, "")
    .trim()
    .slice(0, MAX_TITLE_CHARS)
    .trim();
}

export function readRecipeText(contentType: string | null, body: string): PayloadResult {
  const raw = extract(contentType, body);
  if (raw === "bad_json" || raw === "empty") return { ok: false, error: raw };
  const text = clean(raw);
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MAX_TEXT_CHARS) return { ok: false, error: "too_large" };
  if (!looksLikeRecipe(text)) return { ok: false, error: "not_a_recipe" };
  return { ok: true, text, title: recipeTitle(text) };
}
