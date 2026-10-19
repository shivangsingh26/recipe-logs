// Assembles step text from numbered items, bullets, "Step 2: Fry" lines, heading-steps
// ("### 1. Marinate" + paragraph) and plain paragraphs, including continuation lines.

export type StepKind = "list" | "titled" | "plain";

export interface OpenStep {
  kind: StepKind;
  /** Title from a heading/bold line/"Step N:" prefix; rendered as "**Title:** body". */
  title: string | null;
  titleBold: boolean;
  body: string;
  /** Indent of the marker line; deeper lines continue this step. */
  markerIndent: number;
  /** Indent of the text after the marker; stripped from continuation lines. */
  contentIndent: number;
  numbered: boolean;
  lastHardBreak: boolean;
}

export interface StepItem {
  text: string;
  group?: string;
}

/** "**Make the birista:**" alone — the next line joins with a space, not a newline. */
export function isTitleOnly(body: string): boolean {
  return /^\*\*[^*\n]+\*\*:?$/.test(body.trim());
}

function render(step: OpenStep): string {
  const body = step.body.trim();
  if (step.title == null) return body;
  const title = step.title.trim();
  if (!title) return body;
  if (!body) return step.titleBold ? `**${title}**` : title;
  const label = /[.:!?]$/.test(title) ? title : `${title}:`;
  return `**${label}**${/^(?:[-*•] |\d+[.)] )/.test(body) ? "\n" : " "}${body}`;
}

export class StepCollector {
  readonly items: StepItem[] = [];
  group: string | undefined;
  current: OpenStep | null = null;

  open(kind: StepKind, body: string, options: Partial<Omit<OpenStep, "kind" | "body">> = {}): void {
    this.close();
    this.current = {
      kind,
      body,
      title: options.title ?? null,
      titleBold: options.titleBold ?? false,
      markerIndent: options.markerIndent ?? 0,
      contentIndent: options.contentIndent ?? 0,
      numbered: options.numbered ?? false,
      lastHardBreak: options.lastHardBreak ?? false,
    };
  }

  append(text: string, joiner: string, hardBreak: boolean): void {
    const step = this.current;
    if (!step) return;
    step.body = step.body ? `${step.body}${joiner}${text}` : text;
    step.lastHardBreak = hardBreak;
  }

  close(): void {
    const step = this.current;
    this.current = null;
    if (!step) return;
    const text = render(step);
    if (text) this.items.push(this.group ? { text, group: this.group } : { text });
  }
}
