// Tiny, safe formatting for recipe notes: paragraphs, bullet lists and **bold**. The UI renders
// the parsed structure as React elements, so no HTML from user text ever reaches the DOM.

export type NoteBlock = { type: "paragraph"; lines: string[] } | { type: "list"; items: string[] };

export interface TextSpan {
  text: string;
  bold: boolean;
}

const BULLET_RE = /^[-*•]\s+/;

/** Blank lines separate paragraphs; lines starting with "- ", "* " or "• " become bullet lists. */
export function parseNotes(notes: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  for (const chunk of notes.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)) {
    let paragraph: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
      if (list.length) blocks.push({ type: "list", items: list });
      paragraph = [];
      list = [];
    };
    for (const raw of chunk.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const bullet = BULLET_RE.exec(line);
      if (bullet) {
        if (paragraph.length) flush();
        list.push(line.slice(bullet[0].length));
      } else {
        if (list.length) flush();
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
}

/** "Use **ghee** here" → plain / bold / plain spans. Unpaired asterisks stay as typed. */
export function parseBold(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let last = 0;
  for (const match of text.matchAll(/\*\*(.+?)\*\*/g)) {
    const start = match.index ?? 0;
    if (start > last) spans.push({ text: text.slice(last, start), bold: false });
    spans.push({ text: match[1], bold: true });
    last = start + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false });
  return spans;
}

/** The source as a link target when it is an http(s) URL, else null (plain-text source). */
export function sourceUrl(source: string): string | null {
  const text = source.trim();
  if (!/^https?:\/\/\S+$/i.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** "https://www.example.com/recipes/biryani" → "example.com". */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
