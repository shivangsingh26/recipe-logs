"use client";

import { Sparkles } from "lucide-react";
import { useId, useRef } from "react";
import { Field, NumberInput } from "@/components/ui/Field";
import { caloriesFromMacros } from "@/lib/recipes/nutrition";
import type { Macros } from "@/lib/types";

const FIELDS: ReadonlyArray<{ key: keyof Macros; label: string; suffix: string }> = [
  { key: "calories", label: "Calories", suffix: "kcal" },
  { key: "protein", label: "Protein", suffix: "g" },
  { key: "carbs", label: "Carbs", suffix: "g" },
  { key: "fat", label: "Fat", suffix: "g" },
];

export interface MacrosFieldsProps {
  value: Macros;
  onChange: (macros: Macros) => void;
}

/** Per-serving macro inputs, with a one-tap calorie estimate when only P/C/F are filled in. */
export function MacrosFields({ value, onChange }: MacrosFieldsProps) {
  const baseId = useId();
  const caloriesRef = useRef<HTMLInputElement>(null);
  const estimate = value.calories == null ? caloriesFromMacros(value) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={`${baseId}-${field.key}`}>
            <NumberInput
              id={`${baseId}-${field.key}`}
              ref={field.key === "calories" ? caloriesRef : undefined}
              value={value[field.key]}
              suffix={field.suffix}
              onValueChange={(next) => onChange({ ...value, [field.key]: next })}
            />
          </Field>
        ))}
      </div>
      {estimate != null && (
        <button
          type="button"
          onClick={() => {
            onChange({ ...value, calories: estimate });
            // The hint disappears; keep focus on the field it just filled.
            caloriesRef.current?.focus();
          }}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-accent-soft px-3.5 py-2 text-left text-sm font-medium text-on-accent-soft transition-opacity active:opacity-70"
        >
          <Sparkles aria-hidden className="size-4 shrink-0" />
          <span>
            ≈ {estimate} kcal from macros — <span className="underline underline-offset-2">use</span>
          </span>
        </button>
      )}
    </>
  );
}
