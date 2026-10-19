import { Lock } from "lucide-react";
import { APP_VERSION } from "@/lib/backup";
import { SettingsRow, SettingsSection } from "./SettingsSection";

export function AboutSection() {
  return (
    <SettingsSection title="About" className="divide-y divide-line">
      <SettingsRow label="CulinaryLog" description="Recipe vault and daily cook log">
        <span className="text-[15px] tabular-nums text-muted">Version {APP_VERSION}</span>
      </SettingsRow>
      <div className="flex gap-3 py-4">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">Local-first:</span> your recipes and logs never leave this device
          unless you export them.
        </p>
      </div>
    </SettingsSection>
  );
}
