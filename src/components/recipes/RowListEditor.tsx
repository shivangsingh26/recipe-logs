"use client";

import { ArrowUpDown, Check, ChevronDown, ChevronUp, Heading, Plus, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import {
  applyPaste,
  insertRow,
  itemNumbers,
  moveRow,
  removeRow,
  type EditorRow,
  type RowKind,
} from "@/lib/recipes/editorRows";

type RowAction = "up" | "down" | "remove";
type PendingFocus = { id: string; target: "field"; caret?: number } | { id: string; target: RowAction } | "add";
type FieldElement = HTMLInputElement | HTMLTextAreaElement;

const COPY = {
  ingredients: { noun: "ingredient", add: "Add ingredient", placeholder: "e.g. 2 tbsp ghee" },
  steps: { noun: "step", add: "Add step", placeholder: "What to do next…" },
} as const;

export interface RowListEditorProps {
  variant: "ingredients" | "steps";
  rows: EditorRow[];
  onChange: (rows: EditorRow[]) => void;
}

/**
 * Ordered list of items and section headings. Enter adds a row below, Backspace in an empty
 * row removes it, and pasting several lines splits them into rows (headings detected).
 * Move buttons only show in "Reorder" mode, so on a phone the text keeps most of the width.
 */
export function RowListEditor({ variant, rows, onChange }: RowListEditorProps) {
  const copy = COPY[variant];
  const rowElements = useRef(new Map<string, HTMLLIElement>());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const numbers = itemNumbers(rows);
  const [reordering, setReordering] = useState(false);

  // Rows are re-rendered (or moved) after each edit; put focus where the edit left off.
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (pending === "add") addButtonRef.current?.focus();
    else focusInRow(rowElements.current.get(pending.id), pending);
  });

  const commit = (next: EditorRow[], focus: PendingFocus | null = null) => {
    pendingFocus.current = focus;
    onChange(next);
  };

  const setText = (index: number, text: string) => commit(rows.map((row, i) => (i === index ? { ...row, text } : row)));

  const add = (kind: RowKind) => {
    const { rows: next, id } = insertRow(rows, rows.length - 1, kind);
    commit(next, { id, target: "field" });
  };

  const move = (index: number, delta: -1 | 1) =>
    commit(moveRow(rows, index, delta), { id: rows[index].id, target: delta < 0 ? "up" : "down" });

  const remove = (index: number) => {
    const next = removeRow(rows, index);
    const neighbour = next[index] ?? next[index - 1];
    commit(next, neighbour ? { id: neighbour.id, target: "remove" } : "add");
  };

  const onKeyDown = (e: KeyboardEvent<FieldElement>, index: number) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const { rows: next, id } = insertRow(rows, index, "item");
      commit(next, { id, target: "field" });
    } else if (e.key === "Backspace" && rows[index].text === "" && index > 0) {
      e.preventDefault();
      commit(removeRow(rows, index), { id: rows[index - 1].id, target: "field" });
    }
  };

  const onPaste = (e: ClipboardEvent<FieldElement>, index: number) => {
    const field = e.currentTarget;
    const end = field.value.length;
    const selection = { start: field.selectionStart ?? end, end: field.selectionEnd ?? end };
    const result = applyPaste(rows, index, selection, e.clipboardData.getData("text/plain"));
    if (!result) return;
    e.preventDefault();
    commit(result.rows, { id: result.focusId, target: "field", caret: result.caret });
  };

  const fieldFor = (row: EditorRow, index: number, name: string) => {
    const shared = {
      value: row.text,
      enterKeyHint: "next" as const,
      onChange: (e: { target: { value: string } }) => setText(index, e.target.value),
      onKeyDown: (e: KeyboardEvent<FieldElement>) => onKeyDown(e, index),
      onPaste: (e: ClipboardEvent<FieldElement>) => onPaste(e, index),
    };
    if (row.kind === "heading") {
      return (
        <input
          {...shared}
          aria-label="Section name"
          placeholder="Section, e.g. Marinade"
          maxLength={120}
          className={cn(
            "h-11 w-full rounded-lg border border-dashed border-line-strong bg-transparent px-3 text-base font-semibold",
            "tracking-[0.06em] text-muted [font-variant-caps:all-small-caps] placeholder:text-subtle",
            "transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15",
          )}
        />
      );
    }
    // Single-row text areas that grow, so long ingredients wrap instead of being cut off.
    return (
      <TextArea
        {...shared}
        aria-label={name}
        rows={1}
        placeholder={copy.placeholder}
        maxLength={variant === "steps" ? undefined : 1000}
        className="!min-h-12"
      />
    );
  };

  return (
    <div>
      {rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((row, index) => {
            const isStep = variant === "steps" && row.kind === "item";
            const name = row.kind === "heading" ? "section" : `${capitalize(copy.noun)} ${numbers[index]}`;
            return (
              <li
                key={row.id}
                ref={(element) => {
                  if (element) rowElements.current.set(row.id, element);
                  else rowElements.current.delete(row.id);
                }}
                className={cn("flex items-start gap-1.5", row.kind === "heading" && index > 0 && "pt-3")}
              >
                {isStep && (
                  <span
                    aria-hidden
                    className="mt-3 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular-nums text-on-accent-soft"
                  >
                    {numbers[index]}
                  </span>
                )}
                <div className="min-w-0 flex-1">{fieldFor(row, index, name)}</div>
                <RowControls
                  name={name.toLowerCase()}
                  reordering={reordering}
                  first={index === 0}
                  last={index === rows.length - 1}
                  onMove={(delta) => move(index, delta)}
                  onRemove={() => remove(index)}
                />
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button ref={addButtonRef} variant="soft" icon={<Plus aria-hidden />} onClick={() => add("item")}>
          {copy.add}
        </Button>
        <Button variant="ghost" icon={<Heading aria-hidden />} onClick={() => add("heading")}>
          Add section
        </Button>
        {rows.length > 1 && (
          <Button
            variant="ghost"
            aria-pressed={reordering}
            icon={reordering ? <Check aria-hidden /> : <ArrowUpDown aria-hidden />}
            onClick={() => setReordering((on) => !on)}
            className="ml-auto"
          >
            {reordering ? "Done" : "Reorder"}
          </Button>
        )}
      </div>
    </div>
  );
}

function RowControls({
  name,
  reordering,
  first,
  last,
  onMove,
  onRemove,
}: {
  name: string;
  reordering: boolean;
  first: boolean;
  last: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  if (!reordering) {
    return (
      <IconButton size="sm" label={`Remove ${name}`} data-row-action="remove" onClick={onRemove} className="mt-1.5 self-start">
        <X aria-hidden className="text-muted" />
      </IconButton>
    );
  }
  return (
    <div className="flex shrink-0 self-start pt-1.5">
      <IconButton size="sm" label={`Move ${name} up`} data-row-action="up" disabled={first} onClick={() => onMove(-1)}>
        <ChevronUp aria-hidden className="text-muted" />
      </IconButton>
      <IconButton size="sm" label={`Move ${name} down`} data-row-action="down" disabled={last} onClick={() => onMove(1)}>
        <ChevronDown aria-hidden className="text-muted" />
      </IconButton>
    </div>
  );
}

function focusInRow(row: HTMLLIElement | undefined, pending: Exclude<PendingFocus, "add">): void {
  if (!row) return;
  if (pending.target === "field") {
    const field = row.querySelector<FieldElement>("input, textarea");
    if (!field) return;
    field.focus();
    const caret = pending.caret ?? field.value.length;
    field.setSelectionRange(caret, caret);
    return;
  }
  // A move can disable the pressed button (now first/last): fall back to its sibling.
  const order: RowAction[] =
    pending.target === "up" ? ["up", "down", "remove"] : pending.target === "down" ? ["down", "up", "remove"] : ["remove"];
  for (const action of order) {
    const button = row.querySelector<HTMLButtonElement>(`[data-row-action="${action}"]`);
    if (button && !button.disabled) {
      button.focus();
      return;
    }
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
