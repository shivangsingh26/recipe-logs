"use client";

import { AboutSection } from "./AboutSection";
import { AppearanceSection } from "./AppearanceSection";
import { BackupSection } from "./BackupSection";
import { CookingSection } from "./CookingSection";
import { DataSection } from "./DataSection";
import { GeminiSection } from "./GeminiSection";
import { InstallSection } from "./InstallSection";
import { useExporter } from "./useExporter";

export function SettingsScreen() {
  // One exporter for the whole screen, so "Back up first" (erase) and the backup card share state.
  const exporter = useExporter();
  return (
    <main className="flex flex-col gap-7 px-4 pb-nav pt-5">
      <BackupSection exporter={exporter} />
      <AppearanceSection />
      <CookingSection />
      <GeminiSection />
      <DataSection exporter={exporter} />
      <InstallSection />
      <AboutSection />
    </main>
  );
}
