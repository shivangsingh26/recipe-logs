"use client";

import { BellRing, Pause, Play, Timer as TimerIcon, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { finishedAgo, spokenDuration } from "@/lib/timers/labels";
import { remainingMs, type KitchenTimer } from "@/lib/timers/store";
import { recipeTimerHref, useTimerActions } from "./TimerProvider";

export interface TimerRowProps {
  timer: KitchenTimer;
  now: number;
}

/** One timer in the dock: countdown + label (links to the recipe) and its controls. */
export function TimerRow({ timer, now }: TimerRowProps) {
  const { pause, resume, addTime, dismiss, silence } = useTimerActions();
  const done = timer.status === "done";
  const paused = timer.status === "paused";
  const left = remainingMs(timer, now);
  const progress = timer.durationMs > 0 ? Math.min(1, 1 - left / timer.durationMs) : 1;
  const elapsedSinceDone = timer.doneAt != null ? now - timer.doneAt : 0;

  const summary = done
    ? elapsedSinceDone >= 60_000
      ? `Done · ${finishedAgo(elapsedSinceDone)}`
      : "Done!"
    : formatClock(left / 1000);
  const body = (
    <>
      <span className={cn("block font-semibold leading-tight tabular-nums", done ? "text-xl" : "text-[26px] tracking-tight")}>
        {summary}
      </span>
      <span className={cn("block truncate text-xs leading-snug", done ? "text-on-accent/85" : "text-muted")}>
        {paused ? "Paused · " : ""}
        {timer.label}
      </span>
    </>
  );

  return (
    <div className={cn("relative flex min-h-16 items-center gap-2 py-2 pl-3 pr-1.5", done && "bg-accent text-on-accent")}>
      <StatusIcon status={timer.status} />
      {timer.recipeId ? (
        <Link
          href={recipeTimerHref(timer.recipeId)}
          className="min-w-0 flex-1 rounded-lg py-1 outline-offset-0"
          aria-label={`${timer.label}, ${done ? "done" : `${spokenDuration(left / 1000)} left`}. Open recipe`}
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1 py-1">{body}</div>
      )}

      {done ? (
        <div className="flex shrink-0 items-center gap-1.5 pr-1.5">
          <button
            type="button"
            onClick={() => addTime(timer.id)}
            className="h-11 rounded-xl bg-on-accent/15 px-3 text-sm font-semibold tabular-nums transition-transform active:scale-95"
          >
            +1 min
          </button>
          <button
            type="button"
            onClick={() => {
              silence();
              dismiss(timer.id);
            }}
            className="h-11 rounded-xl bg-on-accent px-4 text-sm font-semibold text-accent transition-transform active:scale-95"
          >
            Stop
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center">
          <IconButton
            label={paused ? "Resume timer" : "Pause timer"}
            onClick={() => (paused ? resume(timer.id) : pause(timer.id))}
          >
            {paused ? <Play /> : <Pause />}
          </IconButton>
          <IconButton label="Add 1 minute" onClick={() => addTime(timer.id)} className="text-[15px] font-semibold tabular-nums">
            +1
          </IconButton>
          <IconButton label="Cancel timer" onClick={() => dismiss(timer.id)} className="text-muted">
            <X />
          </IconButton>
        </div>
      )}

      {!done && (
        <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-line">
          <span
            className={cn("block h-full rounded-full", paused ? "bg-subtle" : "bg-accent")}
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: KitchenTimer["status"] }): ReactNode {
  const shared = "size-5 shrink-0";
  if (status === "done") return <BellRing aria-hidden className={cn(shared, "animate-ring")} />;
  if (status === "paused") return <Pause aria-hidden className={cn(shared, "text-muted")} />;
  return <TimerIcon aria-hidden className={cn(shared, "text-accent")} />;
}
