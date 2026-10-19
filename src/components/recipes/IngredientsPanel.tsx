"use client";

import { Check } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Card, SectionLabel } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { resetCookState, toggleIngredientChecked } from "@/lib/db";
import { formatNumber, pluralize } from "@/lib/format";
import { groupIntoSections } from "@/lib/recipes/sections";
import type { Recipe } from "@/lib/types";
import { PanelEmpty } from "./PanelEmpty";
import { ProgressHeader } from "./ProgressHeader";

export interface IngredientsPanelProps {
  recipe: Recipe;
  checkedIds: readonly string[];
}

/** Ingredients as a tickable shopping/mise-en-place list, grouped by section. */
export function IngredientsPanel({ recipe, checkedIds }: IngredientsPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const total = recipe.ingredients.length;
  if (total === 0) return <PanelEmpty recipeId={recipe.id}>No ingredients yet.</PanelEmpty>;

  const checked = new Set(checkedIds);
  const anyChecked = recipe.ingredients.some((i) => checked.has(i.id));
  const servings = recipe.servings != null && recipe.servings > 0 ? ` · serves ${formatNumber(recipe.servings)}` : "";

  const reset = async () => {
    await resetCookState(recipe.id);
    // The Reset button disappears; keep focus inside the list.
    rootRef.current?.querySelector<HTMLElement>("[role='checkbox']")?.focus();
  };

  return (
    <div ref={rootRef}>
      <ProgressHeader summary={`${pluralize(total, "ingredient")}${servings}`} onReset={anyChecked ? reset : undefined} />
      <div className="space-y-4">
        {groupIntoSections(recipe.ingredients).map((section) => (
          <div key={section.entries[0].item.id}>
            {section.group && <SectionLabel className="mb-2">{section.group}</SectionLabel>}
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {section.entries.map(({ item }) => (
                  <li key={item.id}>
                    <CheckRow
                      checked={checked.has(item.id)}
                      onToggle={() => void toggleIngredientChecked(recipe.id, item.id)}
                    >
                      {item.text}
                    </CheckRow>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckRow({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2"
    >
      <span
        aria-hidden
        className={cn(
          "mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
          checked ? "border-accent bg-accent text-on-accent" : "border-line-strong",
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span
        className={cn(
          "text-base leading-snug transition-colors",
          checked ? "text-muted line-through decoration-1" : "text-ink",
        )}
      >
        {children}
      </span>
    </button>
  );
}
