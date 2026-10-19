"use client";

// A recipe step: **bold** runs (no innerHTML) and every duration phrase ("14 min",
// "1 hr 30 min", "5–6 minutes") as an inline tap-to-start timer chip.

import { Fragment, useMemo } from "react";
import { cn } from "@/lib/cn";
import { stepSegments } from "@/lib/markdown/inline";
import { TimerChip } from "./TimerChip";

export interface StepTextProps {
  text: string;
  recipeId: string;
  recipeTitle: string;
  stepId: string;
  /** 1-based step number, used in the timer label ("Step 3 · Kacchi Biryani"). */
  stepNumber: number;
  className?: string;
}

export function StepText({ text, recipeId, recipeTitle, stepId, stepNumber, className }: StepTextProps) {
  const segments = useMemo(() => stepSegments(text), [text]);
  return (
    <p className={cn("whitespace-pre-line", className)}>
      {segments.map((segment, index) => {
        if (segment.kind === "timer") {
          return (
            <TimerChip
              key={index}
              match={segment.match}
              recipeId={recipeId}
              recipeTitle={recipeTitle}
              stepId={stepId}
              stepNumber={stepNumber}
            />
          );
        }
        return segment.bold ? (
          <strong key={index} className="font-semibold text-ink">
            {segment.text}
          </strong>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        );
      })}
    </p>
  );
}
