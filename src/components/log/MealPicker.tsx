"use client";

import { useRef, type KeyboardEvent } from "react";
import { MEAL_STYLES } from "@/components/ui/MealBadge";
import { cn } from "@/lib/cn";
import { MEAL_LABELS, type MealType } from "@/lib/types";

/** Chronological, which is how people think about a day's meals. */
const MEALS: readonly MealType[] = ["breakfast", "lunch", "snack", "dinner"];

export interface MealPickerProps {
  value: MealType;
  onChange: (meal: MealType) => void;
  /** id of the visible label for the group. */
  labelledBy: string;
}

/** Single-choice meal tag: four equal tiles in the meal colours (radio-group semantics). */
export function MealPicker({ value, onChange, labelledBy }: MealPickerProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + MEALS.length) % MEALS.length;
    onChange(MEALS[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-4 gap-2">
      {MEALS.map((meal, index) => {
        const style = MEAL_STYLES[meal];
        const Icon = style.icon;
        const selected = meal === value;
        return (
          <button
            key={meal}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(meal)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-[13px] font-semibold",
              "transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.97]",
              selected
                ? cn("border-transparent ring-2 ring-inset", style.ring, style.soft, style.text)
                : "border-line bg-surface text-ink hover:bg-surface-2",
            )}
          >
            <Icon aria-hidden className={cn("size-5", style.text)} />
            {MEAL_LABELS[meal]}
          </button>
        );
      })}
    </div>
  );
}
