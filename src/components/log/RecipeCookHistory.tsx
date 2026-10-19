"use client";

import { Plus } from "lucide-react";
import { useId, useMemo, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { fromDateKey } from "@/lib/dates";
import { useLogsForRecipe } from "@/lib/db";
import { cookSummary, formatCookSummary } from "@/lib/log/stats";
import { LogDishSheet } from "./LogDishSheet";
import { LogEntryCard } from "./LogEntryCard";
import { useFocusRescue } from "./useFocusRescue";
import { useLogSheet } from "./useLogSheet";
import { useToday } from "./useToday";

/**
 * The "Cook history" section of a recipe page: every logged cook of this recipe, newest first,
 * with its tweaks and plate photo. Tap an entry to edit it.
 */
export function RecipeCookHistory({ recipeId }: { recipeId: string }) {
  const logs = useLogsForRecipe(recipeId);
  const today = useToday();
  const { sheetProps, openNew, openEdit } = useLogSheet();
  const headingId = useId();
  const introRef = useRef<HTMLDivElement>(null);
  const rescue = useFocusRescue(introRef, logs);
  const summary = useMemo(() => cookSummary(logs ?? []), [logs]);
  const ready = logs !== undefined && today !== null;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div ref={introRef} tabIndex={-1} className="px-1 outline-none">
        <SectionLabel id={headingId} className="px-0">
          Cook history
        </SectionLabel>
        <p className="mt-1 text-[15px] text-ink">
          {ready ? formatCookSummary(summary, fromDateKey(today)) : " "}
        </p>
      </div>
      {!ready ? (
        <Skeleton className="h-28 rounded-2xl" />
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-4 py-7 text-center">
          <p className="text-[15px] text-muted">
            Log it after you cook. Your tweaks and a plate photo will be here for next time.
          </p>
          <Button variant="soft" icon={<Plus />} className="mt-4" onClick={() => openNew(today, recipeId)}>
            Log this dish
          </Button>
        </div>
      ) : (
        <ul className="space-y-3" {...rescue}>
          {logs.map((log) => (
            <li key={log.id}>
              <LogEntryCard log={log} variant="history" onEdit={openEdit} />
            </li>
          ))}
        </ul>
      )}
      <LogDishSheet {...sheetProps} />
    </section>
  );
}
