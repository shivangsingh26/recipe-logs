// Minimal inline Markdown for step text: `**bold**` runs only, rendered without innerHTML.

import { findDurations, type DurationMatch } from "@/lib/parser/durations";

export interface InlineSegment {
  text: string;
  bold: boolean;
}

const BOLD = /\*\*(?=\S)([\s\S]*?\S)\*\*/g;

/** "**Sear:** Add the chicken" → [{ "Sear:", bold }, { " Add the chicken" }]. */
export function splitBold(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  BOLD.lastIndex = 0;
  for (let m = BOLD.exec(text); m; m = BOLD.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}

export type StepSegment =
  | { kind: "text"; text: string; bold: boolean }
  | { kind: "timer"; match: DurationMatch; bold: boolean };

/** Step text split into bold/plain runs with every duration phrase as its own timer segment. */
export function stepSegments(text: string): StepSegment[] {
  const out: StepSegment[] = [];
  for (const run of splitBold(text)) {
    let last = 0;
    for (const match of findDurations(run.text)) {
      if (match.start > last) out.push({ kind: "text", text: run.text.slice(last, match.start), bold: run.bold });
      out.push({ kind: "timer", match, bold: run.bold });
      last = match.end;
    }
    if (last < run.text.length) out.push({ kind: "text", text: run.text.slice(last), bold: run.bold });
  }
  return out;
}

/** Text with bold markers removed (for labels, search, accessibility). */
export function plainText(text: string): string {
  return splitBold(text)
    .map((s) => s.text)
    .join("");
}
