"use client";

import { Check, Timer } from "lucide-react";
import { useRef } from "react";
import { StepText } from "@/components/timers/StepText";
import { Card, SectionLabel } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { resetCookState, toggleStepDone } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { groupIntoSections } from "@/lib/recipes/sections";
import type { Recipe, Step } from "@/lib/types";
import { PanelEmpty } from "./PanelEmpty";
import { ProgressHeader } from "./ProgressHeader";

export interface StepsPanelProps {
  recipe: Recipe;
  doneIds: readonly string[];
}

/** Numbered steps; tapping a number marks the step done. Durations become timers via StepText. */
export function StepsPanel({ recipe, doneIds }: StepsPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const total = recipe.steps.length;
  if (total === 0) return <PanelEmpty recipeId={recipe.id}>No steps yet.</PanelEmpty>;

  const done = new Set(doneIds);
  const doneCount = recipe.steps.filter((s) => done.has(s.id)).length;

  const reset = async () => {
    await resetCookState(recipe.id);
    rootRef.current?.querySelector<HTMLElement>("[role='checkbox']")?.focus();
  };

  return (
    <div ref={rootRef}>
      <ProgressHeader
        summary={doneCount > 0 ? `${pluralize(total, "step")} · ${doneCount} done` : pluralize(total, "step")}
        onReset={doneCount > 0 ? reset : undefined}
      />
      <p className="mb-3 flex items-center gap-2 text-sm text-muted">
        <Timer aria-hidden className="size-4 shrink-0" />
        Tap a time like “14 min” to start a timer.
      </p>
      <div className="space-y-4">
        {groupIntoSections(recipe.steps).map((section) => (
          <div key={section.entries[0].item.id}>
            {section.group && <SectionLabel className="mb-2">{section.group}</SectionLabel>}
            <Card>
              <ol className="divide-y divide-line">
                {section.entries.map(({ item, index }) => (
                  <StepRow key={item.id} recipe={recipe} step={item} number={index + 1} done={done.has(item.id)} />
                ))}
              </ol>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepRow({ recipe, step, number, done }: { recipe: Recipe; step: Step; number: number; done: boolean }) {
  return (
    <li className="flex gap-2 py-3 pl-2 pr-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Step ${number} done`}
        onClick={() => void toggleStepDone(recipe.id, step.id)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors",
            done ? "bg-accent text-on-accent" : "bg-accent-soft text-on-accent-soft",
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : number}
        </span>
      </button>
      <div className={cn("min-w-0 flex-1 pt-[9px] transition-opacity duration-200", done && "opacity-50")}>
        <StepText
          text={step.text}
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          stepId={step.id}
          stepNumber={number}
          className="text-base leading-relaxed text-ink"
        />
      </div>
    </li>
  );
}
