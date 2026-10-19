"use client";

import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { SettingsSection } from "./SettingsSection";
import { TimerAlertsRow } from "./TimerAlertsRow";
import { useDeviceSupport } from "./useDeviceSupport";

type WeekStart = "monday" | "sunday";

const WEEK_OPTIONS: ReadonlyArray<SegmentOption<WeekStart>> = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
];

export function CookingSection() {
  const prefs = usePrefs();
  const support = useDeviceSupport();

  return (
    <SettingsSection title="Cooking" className="divide-y divide-line">
      <Switch
        className="py-2"
        label="Timer sound"
        description="Chime when a timer finishes."
        checked={prefs.timerSound}
        onCheckedChange={(on) => setPrefs({ timerSound: on })}
      />
      {support.vibrate && (
        <Switch
          className="py-2"
          label="Vibrate"
          description="Buzz when a timer finishes."
          checked={prefs.timerVibrate}
          onCheckedChange={(on) => setPrefs({ timerVibrate: on })}
        />
      )}
      <Switch
        className="py-2"
        label="Keep screen awake"
        description={support.wakeLock ? "While a timer is running." : "Not supported by this browser."}
        checked={prefs.keepAwake}
        disabled={!support.wakeLock}
        onCheckedChange={(on) => setPrefs({ keepAwake: on })}
      />
      <TimerAlertsRow />
      <div className="flex min-h-14 items-center gap-4 py-3">
        <p className="min-w-0 flex-1 text-[15px] font-medium text-ink">Week starts on</p>
        <SegmentedControl
          label="Week starts on"
          className="w-44 shrink-0"
          options={WEEK_OPTIONS}
          value={prefs.weekStartsOn === 0 ? "sunday" : "monday"}
          onChange={(day) => setPrefs({ weekStartsOn: day === "sunday" ? 0 : 1 })}
        />
      </div>
    </SettingsSection>
  );
}
