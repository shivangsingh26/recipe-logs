"use client";

import { CalendarDays, List, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Fab";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import {
  addMonths,
  firstDayOfMonth,
  fromDateKey,
  lastDayOfMonth,
  monthGrid,
  monthOf,
  type MonthRef,
} from "@/lib/dates";
import { useAllLogs, useLogsInRange, useRecipes } from "@/lib/db";
import {
  formatMonthName,
  formatMonthSummary,
  formatTotals,
  groupByDate,
  isInMonth,
  logTotals,
} from "@/lib/log/group";
import { usePrefs } from "@/lib/prefs";
import type { CookLog } from "@/lib/types";
import { CookCalendar } from "./CookCalendar";
import { DayPanel } from "./DayPanel";
import { LogDishSheet } from "./LogDishSheet";
import { LogScreenSkeleton } from "./LogScreenSkeleton";
import { LogTimeline } from "./LogTimeline";
import { setLogView, useLogView, type LogView } from "./useLogView";
import { useLogSheet } from "./useLogSheet";
import { useToday } from "./useToday";

const VIEW_OPTIONS: ReadonlyArray<SegmentOption<LogView>> = [
  { value: "calendar", label: "Calendar", icon: <CalendarDays aria-hidden /> },
  { value: "timeline", label: "Timeline", icon: <List aria-hidden /> },
];

/** /log/: calendar + timeline of cooked dishes. Reads ?new=1, so render it inside <Suspense>. */
export function LogScreen() {
  const today = useToday();
  if (!today) return <LogScreenSkeleton />;
  return <CookLogScreen today={today} />;
}

function CookLogScreen({ today }: { today: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { weekStartsOn } = usePrefs();
  const view = useLogView();
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  const { sheetProps, openNew, openEdit } = useLogSheet();
  const mainRef = useRef<HTMLElement>(null);

  // Home-screen shortcut: /log/?new=1 opens the sheet straight away, then the URL is cleaned.
  const wantsNew = params.get("new") === "1";
  const [handledNew, setHandledNew] = useState(false);
  if (wantsNew !== handledNew) {
    setHandledNew(wantsNew);
    if (wantsNew) openNew(today);
  }
  useEffect(() => {
    if (wantsNew) router.replace("/log/");
  }, [wantsNew, router]);

  // Sticky timeline day headers sit just below the (variable-height) page header.
  useEffect(() => {
    const main = mainRef.current;
    const header = main?.previousElementSibling;
    if (!main || !(header instanceof HTMLElement)) return;
    const update = () => main.style.setProperty("--log-header-h", `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const weeks = useMemo(() => monthGrid(month, weekStartsOn), [month, weekStartsOn]);
  const gridLogs = useLogsInRange(weeks[0][0], weeks[5][6]);
  const allLogs = useAllLogs();
  const recipes = useRecipes();
  const recipeIds = useMemo(() => new Set((recipes ?? []).map((r) => r.id)), [recipes]);
  const logsByDate = useMemo(() => (gridLogs ? groupByDate(gridLogs) : undefined), [gridLogs]);
  const now = fromDateKey(today);

  let subtitle: string;
  if (view === "timeline") subtitle = allLogs ? `All time · ${formatTotals(logTotals(allLogs))}` : " ";
  else if (!gridLogs) subtitle = formatMonthName(month, now);
  else subtitle = formatMonthSummary(month, logTotals(gridLogs, firstDayOfMonth(month), lastDayOfMonth(month)), now);

  const showMonth = (next: MonthRef, day: string) => {
    setMonth(next);
    setSelected(day);
  };

  const shiftMonth = (delta: number) => {
    const next = addMonths(month, delta);
    showMonth(next, isInMonth(today, next) ? today : firstDayOfMonth(next));
  };

  const selectDay = (date: string) => showMonth(isInMonth(date, month) ? month : monthOf(date), date);

  const onSaved = (log: CookLog) => {
    // Show the day that was just logged, even if it's in another month.
    if (view === "calendar") selectDay(log.date);
  };

  return (
    <>
      <PageHeader title="Cook Log" subtitle={subtitle}>
        <SegmentedControl label="View" value={view} onChange={setLogView} options={VIEW_OPTIONS} />
      </PageHeader>
      <main ref={mainRef} className="flex-1 px-4 pb-nav pt-4">
        {view === "calendar" ? (
          <>
            <Card className="p-3">
              <CookCalendar
                month={month}
                weeks={weeks}
                today={today}
                selected={selected}
                logsByDate={logsByDate}
                weekStartsOn={weekStartsOn}
                onSelect={selectDay}
                onShiftMonth={shiftMonth}
                onToday={() => showMonth(monthOf(today), today)}
              />
            </Card>
            <DayPanel
              date={selected}
              today={today}
              logs={logsByDate ? (logsByDate.get(selected) ?? []) : undefined}
              recipeIds={recipeIds}
              onLog={() => openNew(selected)}
              onEdit={openEdit}
            />
          </>
        ) : (
          <LogTimeline
            logs={allLogs}
            today={today}
            recipeIds={recipeIds}
            onEdit={openEdit}
            onLogFirst={() => openNew(today)}
          />
        )}
      </main>
      <Fab label="Log dish" icon={<Plus />} onClick={() => openNew(view === "calendar" ? selected : today)} />
      <LogDishSheet {...sheetProps} onSaved={onSaved} />
    </>
  );
}
