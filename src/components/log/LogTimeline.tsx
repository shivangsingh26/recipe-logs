"use client";

import { NotebookPen, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDayLabel, fromDateKey } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import { timelinePage } from "@/lib/log/group";
import type { CookLog } from "@/lib/types";
import { LogEntryCard } from "./LogEntryCard";
import { useFocusRescue } from "./useFocusRescue";

export interface LogTimelineProps {
  /** Every log (any order); undefined while loading. */
  logs: CookLog[] | undefined;
  today: string;
  recipeIds: ReadonlySet<string>;
  onEdit: (log: CookLog) => void;
  onLogFirst: () => void;
}

const PAGE_DAYS = 30;

/** Newest-first diary grouped by day, with sticky day headers. */
export function LogTimeline({ logs, today, recipeIds, onEdit, onLogFirst }: LogTimelineProps) {
  const [dayLimit, setDayLimit] = useState(PAGE_DAYS);
  const page = useMemo(() => timelinePage(logs ?? [], dayLimit), [logs, dayLimit]);
  const listRef = useRef<HTMLOListElement>(null);
  const focusIndex = useRef<number | null>(null);
  const rescue = useFocusRescue(listRef, logs);
  const now = fromDateKey(today);

  // "Show older" disappears once everything is shown, so move focus to the first new day.
  useEffect(() => {
    const index = focusIndex.current;
    if (index === null) return;
    focusIndex.current = null;
    listRef.current?.querySelectorAll<HTMLElement>("[data-day]")[index]?.focus();
  }, [dayLimit]);

  if (logs === undefined) {
    return (
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (page.days.length === 0) {
    return (
      <EmptyState
        icon={<NotebookPen />}
        title="No dishes logged yet"
        action={
          <Button icon={<Plus />} onClick={onLogFirst}>
            Log your first dish
          </Button>
        }
      >
        Keep a diary of what you cook: the tweaks, the timings and a photo of the plate.
      </EmptyState>
    );
  }

  return (
    <div>
      <ol ref={listRef} tabIndex={-1} aria-label="Cook log timeline" className="space-y-5 outline-none" {...rescue}>
        {page.days.map((day) => (
          <li key={day.date}>
            <h2
              data-day={day.date}
              tabIndex={-1}
              className="sticky top-[var(--log-header-h,0px)] z-10 -mx-4 flex items-baseline justify-between gap-3 bg-canvas/90 px-5 py-2 backdrop-blur-md"
            >
              <span className="text-[15px] font-semibold text-ink">{formatDayLabel(day.date, now)}</span>
              <span className="text-xs text-muted">{pluralize(day.logs.length, "dish", "dishes")}</span>
            </h2>
            <ul className="mt-1 space-y-3">
              {day.logs.map((log) => (
                <li key={log.id}>
                  <LogEntryCard
                    log={log}
                    onEdit={onEdit}
                    recipeAvailable={log.recipeId !== null && recipeIds.has(log.recipeId)}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {page.hasMore && (
        <Button
          variant="secondary"
          fullWidth
          className="mt-6"
          onClick={() => {
            focusIndex.current = dayLimit;
            setDayLimit((n) => n + PAGE_DAYS);
          }}
        >
          Show older
        </Button>
      )}
    </div>
  );
}
