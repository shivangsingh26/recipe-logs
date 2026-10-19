"use client";

import { Clock, Flame, Link2, TriangleAlert, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { formatMinutes, formatNumber, pluralize } from "@/lib/format";
import type { ParseResult } from "@/lib/parser/parseRecipe";
import type { Macros } from "@/lib/types";
import { PreviewList } from "./PreviewList";

export interface ImportPreviewProps {
  result: ParseResult;
  /** The text changed and a fresh parse is pending (useDeferredValue). */
  stale: boolean;
  /** Rendered between the summary and the detailed lists. */
  actions: ReactNode;
}

/** Live preview of what will be saved: summary, warnings, then the parsed lists. */
export function ImportPreview({ result, stale, actions }: ImportPreviewProps) {
  const { draft, warnings } = result;
  const counts = [
    pluralize(draft.ingredients.length, "ingredient"),
    pluralize(draft.steps.length, "step"),
    ...(draft.notes ? ["notes"] : []),
  ].join(" · ");

  return (
    <section aria-labelledby="import-preview-heading" className={cn("transition-opacity duration-150", stale && "opacity-60")}>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4">
          <div>
            <h2 id="import-preview-heading" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Preview
            </h2>
            <h3 className="mt-1 font-serif text-[22px] font-semibold leading-tight text-ink">
              {draft.title}
            </h3>
            {draft.description && (
              <p className="mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-muted">{draft.description}</p>
            )}
          </div>
          <Facts prep={draft.prepMinutes} cook={draft.cookMinutes} servings={draft.servings} />
          <MacroTiles macros={draft.macros} />
          {draft.categories.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Categories">
              {draft.categories.map((category) => (
                <li key={category}>
                  <Badge tone="accent">{category}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm font-medium text-ink">{counts}</p>
          {draft.source && (
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
              <Link2 aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{draft.source}</span>
            </p>
          )}
          {warnings.length > 0 && (
            <div className="flex gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <ul className="flex flex-col gap-1">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {actions}
        </div>
        <PreviewList title="Ingredients" items={draft.ingredients} />
        <PreviewList title="Steps" items={draft.steps} ordered />
        {draft.notes && (
          <section className="border-t border-line px-4 py-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Notes &amp; tips</h3>
            <p className="line-clamp-6 whitespace-pre-line text-[15px] leading-snug text-ink">{draft.notes}</p>
          </section>
        )}
      </Card>
    </section>
  );
}

function Facts({ prep, cook, servings }: { prep: number | null; cook: number | null; servings: number | null }) {
  const facts: Array<{ icon: ReactNode; label: string }> = [];
  if (prep != null) facts.push({ icon: <Clock />, label: `Prep ${formatMinutes(prep) || "0 min"}` });
  if (cook != null) facts.push({ icon: <Flame />, label: `Cook ${formatMinutes(cook) || "0 min"}` });
  if (servings != null) facts.push({ icon: <Users />, label: `Serves ${formatNumber(servings)}` });
  if (!facts.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted" aria-label="Times and servings">
      {facts.map((fact) => (
        <li key={fact.label} className="inline-flex items-center gap-1.5 [&_svg]:size-4 [&_svg]:shrink-0">
          <span aria-hidden className="text-subtle">
            {fact.icon}
          </span>
          {fact.label}
        </li>
      ))}
    </ul>
  );
}

const MACRO_TILES: ReadonlyArray<readonly [keyof Macros, string, string, string]> = [
  ["calories", "kcal", "", "bg-macro-kcal"],
  ["protein", "protein", " g", "bg-macro-protein"],
  ["carbs", "carbs", " g", "bg-macro-carbs"],
  ["fat", "fat", " g", "bg-macro-fat"],
];

function MacroTiles({ macros }: { macros: Macros }) {
  if (MACRO_TILES.every(([key]) => macros[key] == null)) return null;
  return (
    <dl className="grid grid-cols-4 gap-1.5" aria-label="Macros per serving">
      {MACRO_TILES.map(([key, label, unit, dot]) => (
        <div key={key} className="flex flex-col items-center rounded-xl bg-surface-2 px-1 py-2">
          <dd className="text-[15px] font-semibold tabular-nums text-ink">
            {macros[key] == null ? "—" : `${formatNumber(macros[key])}${unit}`}
          </dd>
          <dt className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
            {label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
