"use client";

import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { SORT_OPTIONS, type RecipeSort } from "@/lib/recipes/query";

export interface SortPickerProps {
  value: RecipeSort;
  onChange: (sort: RecipeSort) => void;
}

/** A compact chip showing the current sort; tapping it opens a small picker sheet. */
export function SortPicker({ value, onChange }: SortPickerProps) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];
  return (
    <>
      <Chip
        icon={<ArrowDownUp aria-hidden />}
        aria-pressed={undefined}
        aria-haspopup="dialog"
        aria-label={`Sort: ${current.label}`}
        onClick={() => setOpen(true)}
      >
        {current.short}
        <ChevronDown aria-hidden className="-mr-1 text-muted" />
      </Chip>
      <Sheet open={open} onClose={() => setOpen(false)} title="Sort recipes">
        <div role="radiogroup" aria-label="Sort by" className="-mx-2 pb-1">
          {SORT_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-base transition-colors",
                  "hover:bg-surface-2 active:bg-surface-3",
                  selected ? "font-semibold text-ink" : "text-ink",
                )}
              >
                {option.label}
                {selected && <Check aria-hidden className="size-5 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
