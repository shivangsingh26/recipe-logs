"use client";

import { Plus, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TextInput } from "@/components/ui/Field";
import { canonicalizeCategories, categoryKey, cleanCategory, hasCategory, mergeCategories } from "@/lib/categories";
import { useCategories } from "@/lib/db";

export interface CategoryPickerProps {
  value: string[];
  onChange: (categories: string[]) => void;
  /** Heuristic suggestions for the current draft; already-selected ones are hidden. */
  suggestions: readonly string[];
}

/** Toggle chips for the category vocabulary, a custom "Add" field and a "Suggested" row. */
export function CategoryPicker({ value, onChange, suggestions }: CategoryPickerProps) {
  const vocabulary = useCategories();
  // Categories chosen when the editor opened lead; the order then stays put so chips don't jump while tapping.
  const [pinned] = useState(value);
  const options = mergeCategories(pinned, vocabulary, value);
  const suggested = suggestions.filter((category) => !hasCategory(value, category));

  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);

  // After a suggestion is added its chip disappears; move focus to the now-selected chip.
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    rootRef.current?.querySelector<HTMLElement>(`[data-category="${key}"]`)?.focus();
  });

  const focusAddChip = () => rootRef.current?.querySelector<HTMLElement>("[data-add-category]")?.focus();

  const toggle = (category: string) => {
    const key = categoryKey(category);
    onChange(hasCategory(value, category) ? value.filter((c) => categoryKey(c) !== key) : [...value, category]);
  };

  const addSuggestion = (category: string) => {
    pendingFocus.current = categoryKey(category);
    onChange(mergeCategories(value, [category]));
  };

  const closeCustom = () => {
    setText("");
    setAdding(false);
    focusAddChip();
  };

  const addCustom = () => {
    const clean = cleanCategory(text);
    if (clean) onChange(mergeCategories(value, canonicalizeCategories([clean], vocabulary)));
    closeCustom();
  };

  return (
    <div ref={rootRef}>
      <div className="flex flex-wrap gap-2">
        {options.map((category) => (
          <Chip
            key={categoryKey(category)}
            data-category={categoryKey(category)}
            selected={hasCategory(value, category)}
            onClick={() => toggle(category)}
          >
            {category}
          </Chip>
        ))}
        <Chip
          data-add-category
          aria-pressed={undefined}
          aria-expanded={adding}
          aria-controls={adding ? inputId : undefined}
          icon={<Plus aria-hidden />}
          className="border-dashed"
          onClick={() => (adding ? closeCustom() : setAdding(true))}
        >
          Add
        </Chip>
      </div>

      {adding && (
        <div className="mt-3 flex gap-2">
          <label htmlFor={inputId} className="sr-only">
            New category
          </label>
          <TextInput
            id={inputId}
            autoFocus
            value={text}
            maxLength={40}
            placeholder="e.g. Sunday special"
            enterKeyHint="done"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeCustom();
              }
            }}
          />
          <Button size="lg" onClick={addCustom} disabled={!cleanCategory(text)}>
            Add
          </Button>
        </div>
      )}

      {suggested.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Sparkles aria-hidden className="size-3.5" />
            Suggested
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.map((category) => (
              <Chip
                key={category}
                aria-pressed={undefined}
                aria-label={`Add ${category}`}
                icon={<Plus aria-hidden />}
                className="border-dashed"
                onClick={() => addSuggestion(category)}
              >
                {category}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
