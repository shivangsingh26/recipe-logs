"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { setPrefs, usePrefs, type ThemePref } from "@/lib/prefs";
import { SettingsSection } from "./SettingsSection";

const THEME_OPTIONS: ReadonlyArray<SegmentOption<ThemePref>> = [
  { value: "system", label: "System", icon: <SunMoon /> },
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
];

export function AppearanceSection() {
  const { theme } = usePrefs();
  return (
    <SettingsSection title="Appearance">
      <div className="py-4">
        <p className="mb-2.5 text-[15px] font-medium text-ink">Theme</p>
        <SegmentedControl label="Theme" value={theme} options={THEME_OPTIONS} onChange={(next) => setPrefs({ theme: next })} />
        <p className="mt-2.5 text-sm leading-snug text-muted">System follows your phone&apos;s light or dark setting.</p>
      </div>
    </SettingsSection>
  );
}
