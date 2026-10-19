"use client";

import { Plus } from "lucide-react";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDayLabel, fromDateKey } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import type { CookLog } from "@/lib/types";
import { LogEntryCard } from "./LogEntryCard";
import { useFocusRescue } from "./useFocusRescue";

export interface DayPanelProps {
  date: string;
  today: string;
  /** That day's entries, meal-ordered; undefined while loading. */
  logs: CookLog[] | undefined;
  recipeIds: ReadonlySet<string>;
  onLog: () => void;
  onEdit: (log: CookLog) => void;
}

/** The selected calendar day: its entries and a "Log a dish" shortcut. */
export function DayPanel({ date, today, logs, recipeIds, onLog, onEdit }: DayPanelProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rescue = useFocusRescue(headingRef, logs);
  const now = fromDateKey(today);
  const day = fromDateKey(date);
  const fullDate = day.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(day.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });

  return (
    <section aria-labelledby={headingId} className="mt-7">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-[22px] font-semibold leading-tight text-ink"
          >
            {formatDayLabel(date, now)}
          </h2>
          <p className="truncate text-sm text-muted">
            {fullDate}
            {logs && logs.length > 0 && ` · ${pluralize(logs.length, "dish", "dishes")}`}
          </p>
        </div>
        <Button variant="soft" icon={<Plus />} onClick={onLog}>
          Log a dish
        </Button>
      </div>

      {logs === undefined ? (
        <Skeleton className="mt-3 h-28 rounded-2xl" />
      ) : logs.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-7 text-center text-[15px] text-muted">
          Nothing logged. What did you cook?
        </p>
      ) : (
        <ul className="mt-3 space-y-3" {...rescue}>
          {logs.map((log) => (
            <li key={log.id}>
              <LogEntryCard
                log={log}
                onEdit={onEdit}
                recipeAvailable={log.recipeId !== null && recipeIds.has(log.recipeId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
