"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Card, cardInteractive } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Chip";
import { MealBadge } from "@/components/ui/MealBadge";
import { cn } from "@/lib/cn";
import { formatDayLabel, toDateKey } from "@/lib/dates";
import { usePhotoUrl } from "@/lib/db";
import { MEAL_LABELS, type CookLog } from "@/lib/types";
import { PhotoViewer } from "./PhotoViewer";

export interface LogEntryCardProps {
  log: CookLog;
  /** Tapping the card body edits the entry. */
  onEdit: (log: CookLog) => void;
  /** log.recipeId still points at a vault recipe: offers "Open recipe". */
  recipeAvailable?: boolean;
  /** "history" (on a recipe page): the date is the title and there is no recipe link. */
  variant?: "log" | "history";
}

/** Time of day the entry was logged, but only when it was logged on the day it describes. */
function loggedTime(log: CookLog): string | null {
  const created = new Date(log.createdAt);
  if (toDateKey(created) !== log.date) return null;
  return created.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function LogEntryCard({ log, onEdit, recipeAvailable = false, variant = "log" }: LogEntryCardProps) {
  const [viewing, setViewing] = useState(false);
  const thumbUrl = usePhotoUrl(log.photoId, "thumb");
  const dayLabel = formatDayLabel(log.date);
  const meal = MEAL_LABELS[log.mealType];
  const time = loggedTime(log);
  const isHistory = variant === "history";

  return (
    <Card className={cn("relative flex gap-3 p-4", cardInteractive)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <MealBadge meal={log.mealType} />
          {time && (
            <time dateTime={new Date(log.createdAt).toISOString()} className="text-xs text-muted">
              {time}
            </time>
          )}
          {!isHistory && !log.recipeId && <Badge>Custom</Badge>}
        </div>
        <h3 className="mt-2 font-serif text-[19px] font-semibold leading-snug text-ink">
          {/* Stretched over the whole card: the card body is one big "edit" target. */}
          <button
            type="button"
            onClick={() => onEdit(log)}
            aria-label={`Edit ${log.dishName}, ${meal}, ${dayLabel}`}
            className="text-left outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {isHistory ? dayLabel : log.dishName}
          </button>
        </h3>
        {log.notes && <EntryNotes text={log.notes} />}
        {!isHistory && recipeAvailable && log.recipeId && (
          <Link
            href={`/recipe/?id=${encodeURIComponent(log.recipeId)}`}
            className="relative z-10 -mb-2 mt-1 inline-flex h-10 items-center gap-1 text-sm font-semibold text-accent"
          >
            Open recipe
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
      {log.photoId && (
        <button
          type="button"
          onClick={() => setViewing(true)}
          aria-label={`View plate photo of ${log.dishName}`}
          className="relative z-10 size-[76px] shrink-0 self-start overflow-hidden rounded-xl bg-surface-2 transition-transform active:scale-95"
        >
          {thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL of a photo stored on the device
            <img src={thumbUrl} alt="" className="size-full object-cover" />
          )}
        </button>
      )}
      {viewing && log.photoId && (
        <PhotoViewer
          photoId={log.photoId}
          title={log.dishName}
          caption={`${dayLabel} · ${meal}`}
          onClose={() => setViewing(false)}
        />
      )}
    </Card>
  );
}

/** Notes clamped to four lines, with More/Less only when they actually overflow. */
function EntryNotes({ text }: { text: string }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const observer = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <>
      <p
        ref={ref}
        id={id}
        className={cn("mt-1 whitespace-pre-line text-[15px] leading-relaxed text-muted", !expanded && "line-clamp-4")}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
          className="relative z-10 -mb-1 inline-flex h-9 items-center text-sm font-semibold text-accent after:absolute after:-inset-y-1 after:-left-2 after:-right-4 after:content-['']"
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </>
  );
}
