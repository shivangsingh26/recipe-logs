"use client";

import { BellRing, Pause, Timer as TimerIcon } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import type { DurationMatch } from "@/lib/parser/durations";
import { spokenDuration, spokenLength } from "@/lib/timers/labels";
import { requestTimerNotifications, timerNotificationStatus } from "@/lib/timers/notify";
import { remainingMs, timerKey } from "@/lib/timers/store";
import { useTimerNow, useTimers } from "./TimerProvider";

export interface TimerChipProps {
  match: DurationMatch;
  recipeId: string;
  recipeTitle: string;
  stepId: string;
  stepNumber: number;
}

let offeredNotifications = false;

/** A duration inside step text ("14 min") that starts, pauses, resumes and dismisses its timer. */
export function TimerChip({ match, recipeId, recipeTitle, stepId, stepNumber }: TimerChipProps) {
  const { timers, start, dismiss } = useTimers();
  const now = useTimerNow();
  const toast = useToast();
  const key = timerKey(recipeId, stepId, match.seconds);
  const timer = timers.find((t) => t.key === key);
  const status = timer?.status ?? "idle";
  const leftSeconds = timer ? remainingMs(timer, now) / 1000 : match.seconds;
  const clock = formatClock(leftSeconds);

  const onClick = () => {
    if (timer?.status === "done") {
      dismiss(timer.id);
      return;
    }
    const { action } = start({
      key,
      label: `Step ${stepNumber} · ${recipeTitle}`,
      detail: match.label,
      durationMs: match.seconds * 1000,
      recipeId,
      stepId,
    });
    if (action !== "started") return;
    // Offer background alerts once per session, from this tap (browsers require a gesture).
    const offer = !offeredNotifications && timerNotificationStatus() === "default";
    offeredNotifications ||= offer;
    toast.show({
      id: `timer-start-${key}`,
      title: `Timer started · ${match.label}`,
      ...(offer
        ? {
            description: "Get an alert even when the app is in the background?",
            action: { label: "Allow", onClick: () => void requestTimerNotifications() },
          }
        : {}),
    });
  };

  const label =
    status === "idle"
      ? `Start ${spokenLength(match.seconds)} timer`
      : status === "running"
        ? `Pause timer, ${spokenDuration(leftSeconds)} left`
        : status === "paused"
          ? `Resume timer, ${spokenDuration(leftSeconds)} left`
          : "Timer done. Dismiss";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "-my-1 mx-0.5 inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full px-2.5 align-middle",
        "text-[0.9375em] font-semibold leading-none tabular-nums transition-[background-color,color,transform] duration-150 active:scale-95",
        "[&_svg]:size-[1.05em] [&_svg]:shrink-0",
        status === "running" || status === "done"
          ? "bg-accent text-on-accent"
          : "bg-accent-soft text-on-accent-soft hover:bg-accent-soft/70",
      )}
    >
      {status === "done" ? (
        <>
          <BellRing aria-hidden className="animate-ring" />
          Done!
        </>
      ) : status === "paused" ? (
        <>
          <Pause aria-hidden />
          Paused {clock}
        </>
      ) : status === "running" ? (
        <>
          <TimerIcon aria-hidden className="animate-pulse" />
          {clock}
        </>
      ) : (
        <>
          <TimerIcon aria-hidden />
          {match.label}
        </>
      )}
    </button>
  );
}
