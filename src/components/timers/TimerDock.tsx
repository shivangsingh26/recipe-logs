"use client";

// Active timers, floating just above the tab bar on every screen. Publishes its height as
// --dock-h on <html> so page padding (pb-nav), FABs and toasts (bottom-above-nav) clear it.

import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { remainingMs, type KitchenTimer } from "@/lib/timers/store";
import { TimerRow } from "./TimerRow";
import { useTimerNow, useTimers } from "./TimerProvider";

const GAP_PX = 8;

/** Finished first (oldest first), then running and paused by time left. */
function sortTimers(timers: readonly KitchenTimer[], now: number): KitchenTimer[] {
  const rank = { done: 0, running: 1, paused: 2 } as const;
  return [...timers].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "done" ? (a.doneAt ?? 0) - (b.doneAt ?? 0) : remainingMs(a, now) - remainingMs(b, now)),
  );
}

export function TimerDock() {
  const { timers } = useTimers();
  const now = useTimerNow();
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = timers.length > 0;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!visible || !el) {
      root.style.setProperty("--dock-h", "0px");
      return;
    }
    const update = () => root.style.setProperty("--dock-h", `${Math.ceil(el.getBoundingClientRect().height) + GAP_PX}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty("--dock-h", "0px");
    };
  }, [visible]);

  if (!visible) return null;

  const sorted = sortTimers(timers, now);
  const collapsible = sorted.length > 2;
  const finished = sorted.filter((t) => t.status === "done");
  const shown = !collapsible || expanded ? sorted : finished.length ? finished : sorted.slice(0, 1);
  const hidden = sorted.filter((t) => !shown.includes(t));
  const nextUp = hidden.find((t) => t.status === "running");

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Kitchen timers"
      className="fixed inset-x-0 z-40 mx-auto w-full max-w-2xl px-3"
      style={{ bottom: `calc(var(--nav-h) + env(safe-area-inset-bottom) + ${GAP_PX}px)` }}
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-float backdrop-blur-xl backdrop-saturate-150">
        <ul className="max-h-[45dvh] divide-y divide-line overflow-y-auto overscroll-contain">
          {shown.map((timer) => (
            <li key={timer.id}>
              <TimerRow timer={timer} now={now} />
            </li>
          ))}
        </ul>
        {collapsible && (hidden.length > 0 || expanded) && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="flex h-11 w-full items-center justify-center gap-1.5 border-t border-line text-sm font-medium text-muted transition-colors active:bg-surface-2"
          >
            {expanded ? (
              "Show less"
            ) : (
              <>
                {hidden.length} more {hidden.length === 1 ? "timer" : "timers"}
                {nextUp && <span className="tabular-nums text-ink">· next {formatClock(remainingMs(nextUp, now) / 1000)}</span>}
              </>
            )}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>
    </div>
  );
}
