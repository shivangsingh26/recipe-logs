// Chat assistants (Gemini, ChatGPT, Claude) wrap recipes in conversation: "Sure! Here's…",
// a ```markdown fence, "Enjoy! Want a vegan version?". This trims that wrapping before parsing,
// so copying a whole reply works as well as copying just the recipe.

const FENCE_RE = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm;
const SECTION_RE = /\b(ingredients|instructions|method|directions|steps)\b/i;

/** Sign-offs assistants add after a recipe. Kept narrow: "Enjoy with raita." is a real tip. */
const SIGN_OFF_RE =
  /^(?:enjoy[!.]?$|enjoy (?:your|the|it|cooking|making)\b|happy cooking|bon app[eé]tit|let me know\b|would you like\b|want me to\b|do you want\b|shall i\b|should i\b|i hope\b|hope you\b|feel free\b|if you(?:'d| would)? like\b)/i;

function looksLikeRecipe(text: string): boolean {
  return /^#{1,6}\s+\S/m.test(text) && SECTION_RE.test(text);
}

/** Drops trailing plain paragraphs that are conversation, not recipe. */
function stripSignOff(text: string): string {
  const paragraphs = text.trimEnd().split(/\n[ \t]*\n/);
  while (paragraphs.length > 1) {
    const last = paragraphs[paragraphs.length - 1].trim().replace(/^[*_]+/, "");
    if (/^([-*+•]|\d+[.)]|#|\|)/.test(last) || !SIGN_OFF_RE.test(last)) break;
    paragraphs.pop();
  }
  return paragraphs.join("\n\n");
}

/**
 * Returns the recipe inside an assistant reply: the largest fenced block that looks like a
 * recipe if there is one, otherwise the text minus a trailing sign-off.
 */
export function unwrapAssistantReply(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  let best: string | null = null;
  for (const match of normalized.matchAll(FENCE_RE)) {
    const inner = match[2];
    if (looksLikeRecipe(inner) && (best === null || inner.length > best.length)) best = inner;
  }
  return best ?? stripSignOff(normalized);
}
