"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { MealDot } from "@/components/ui/MealBadge";
import { cn } from "@/lib/cn";
import { addDays, formatMonth, fromDateKey, monthOf, type MonthRef } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import { dayDots, isInMonth, weekdayLabels } from "@/lib/log/group";
import type { CookLog } from "@/lib/types";

export interface CookCalendarProps {
  month: MonthRef;
  /** 6×7 grid of date keys (monthGrid). */
  weeks: string[][];
  today: string;
  selected: string;
  /** Logs per date key, meal-ordered; undefined while loading. */
  logsByDate: ReadonlyMap<string, CookLog[]> | undefined;
  weekStartsOn: 0 | 1;
  onSelect: (date: string) => void;
  onShiftMonth: (delta: number) => void;
  onToday: () => void;
}

const SWIPE_MIN_PX = 50;
const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const NO_LOGS: CookLog[] = [];

interface SwipeStart {
  id: number;
  x: number;
  y: number;
}

export function CookCalendar({
  month,
  weeks,
  today,
  selected,
  logsByDate,
  weekStartsOn,
  onSelect,
  onShiftMonth,
  onToday,
}: CookCalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const swipe = useRef<SwipeStart | null>(null);
  const swallowClick = useRef(false);
  const weekdays = useMemo(() => weekdayLabels(weekStartsOn), [weekStartsOn]);
  const title = formatMonth(month);
  const todayMonth = monthOf(today);
  const showingToday = selected === today && todayMonth.year === month.year && todayMonth.month === month.month;

  // After arrow-key navigation, move focus to the newly selected day (possibly in another month).
  useEffect(() => {
    const date = pendingFocus.current;
    if (!date) return;
    pendingFocus.current = null;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();
  });

  const onDayKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const step = KEY_STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const next = addDays(date, step);
    pendingFocus.current = next;
    onSelect(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // The browser may still fire a click for this gesture; it must not select a day.
    swallowClick.current = true;
    onShiftMonth(dx < 0 ? 1 : -1);
  };

  return (
    <div>
      <div className="flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => onShiftMonth(-1)}>
          <ChevronLeft />
        </IconButton>
        <h2 aria-live="polite" className="min-w-0 flex-1 truncate text-center font-serif text-lg font-semibold">
          {title}
        </h2>
        <IconButton label="Next month" onClick={() => onShiftMonth(1)}>
          <ChevronRight />
        </IconButton>
        <Chip
          onClick={onToday}
          aria-pressed={undefined}
          className={cn("relative ml-1 after:absolute after:-inset-y-1 after:inset-x-0", showingToday && "invisible")}
        >
          Today
        </Chip>
      </div>

      <div aria-hidden className="mt-2 grid grid-cols-7 pb-1">
        {weekdays.map((day) => (
          <span key={day.long} className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {day.short}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        key={`${month.year}-${month.month}`}
        role="group"
        aria-label={title}
        className="grid animate-fade-in touch-pan-y select-none grid-cols-7 gap-y-1"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {weeks.flat().map((date) => (
          <DayCell
            key={date}
            date={date}
            logs={logsByDate?.get(date) ?? NO_LOGS}
            inMonth={isInMonth(date, month)}
            isToday={date === today}
            isSelected={date === selected}
            onSelect={onSelect}
            onKeyDown={onDayKeyDown}
          />
        ))}
      </div>
    </div>
  );
}

interface DayCellProps {
  date: string;
  logs: CookLog[];
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, date: string) => void;
}

function DayCell({ date, logs, inMonth, isToday, isSelected, onSelect, onKeyDown }: DayCellProps) {
  const dots = dayDots(logs);
  const longDate = fromDateKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const label = `${isToday ? "Today, " : ""}${longDate}, ${
    logs.length ? pluralize(logs.length, "dish", "dishes") : "nothing logged"
  }`;
  const tone = isSelected
    ? "bg-accent-soft font-semibold text-on-accent-soft"
    : isToday
      ? "font-semibold text-accent hover:bg-surface-2"
      : inMonth
        ? "text-ink hover:bg-surface-2"
        : "text-subtle hover:bg-surface-2";

  return (
    <button
      type="button"
      data-date={date}
      tabIndex={isSelected ? 0 : -1}
      aria-pressed={isSelected}
      aria-current={isToday ? "date" : undefined}
      aria-label={label}
      onClick={() => onSelect(date)}
      onKeyDown={(e) => onKeyDown(e, date)}
      className={cn(
        "flex h-11 flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150",
        isToday && "ring-[1.5px] ring-inset ring-accent",
        tone,
      )}
    >
      <span className="text-[15px] leading-none tabular-nums">{Number(date.slice(8))}</span>
      <span className={cn("flex h-1.5 items-center gap-[3px]", !inMonth && "opacity-50")}>
        {dots.meals.map((meal, i) => (
          <MealDot key={i} meal={meal} />
        ))}
        {dots.more && <Plus aria-hidden strokeWidth={4} className="size-2 text-muted" />}
      </span>
    </button>
  );
}
