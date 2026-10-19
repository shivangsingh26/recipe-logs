"use client";

import { CircleCheck, DatabaseBackup, FileBraces, FileText, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { describeLastBackup } from "@/lib/backup";
import { usePrefs } from "@/lib/prefs";
import { BusyButton } from "./BusyButton";
import { RestoreRow } from "./RestoreRow";
import { SettingsRow, SettingsSection } from "./SettingsSection";
import { useHydrated } from "./useDeviceSupport";
import type { Exporter } from "./useExporter";

function BackupStatus({ lastBackupAt }: { lastBackupAt: number | null }) {
  const status = describeLastBackup(lastBackupAt);
  if (!status.stale) {
    return (
      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted">
        <CircleCheck aria-hidden className="size-4 text-success" />
        {status.label}
      </p>
    );
  }
  return (
    <div className="mt-3 flex gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="text-sm leading-snug text-ink">
        <span className="font-semibold">{status.label}.</span> Your recipes and cook log live only on this device, so
        keep a copy somewhere safe.
      </p>
    </div>
  );
}

export function BackupSection({ exporter }: { exporter: Exporter }) {
  const { lastBackupAt } = usePrefs();
  const hydrated = useHydrated();
  const [includePhotos, setIncludePhotos] = useState(true);
  const { busy, run } = exporter;

  return (
    <SettingsSection title="Backup & export" className="divide-y divide-line">
      <div className="py-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-on-accent-soft"
          >
            <DatabaseBackup className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug text-ink">Full backup</h3>
            <p className="mt-0.5 text-sm leading-snug text-muted">
              Recipes, cook log and photos in one .zip file you can restore on any device.
            </p>
          </div>
        </div>
        <BusyButton
          fullWidth
          size="lg"
          className="mt-4"
          icon={<DatabaseBackup />}
          busy={busy === "zip"}
          onClick={() => void run("zip")}
        >
          {busy === "zip" ? "Preparing backup…" : "Back up now"}
        </BusyButton>
        {hydrated ? <BackupStatus lastBackupAt={lastBackupAt} /> : <Skeleton className="mx-auto mt-3 h-5 w-40" />}
      </div>

      <div className="pb-1">
        <SettingsRow label="Export JSON" description="A single file you can restore.">
          <BusyButton
            variant="secondary"
            aria-label="Export JSON"
            icon={<FileBraces />}
            busy={busy === "json"}
            onClick={() => void run("json", { includePhotos })}
          >
            Export
          </BusyButton>
        </SettingsRow>
        <Switch
          label="Include photos"
          description="Bigger file, but nothing left behind."
          checked={includePhotos}
          onCheckedChange={setIncludePhotos}
          className="pb-2"
        />
      </div>

      <SettingsRow label="Export Markdown" description="Readable recipes and cook log. Can't be restored.">
        <BusyButton
          variant="secondary"
          aria-label="Export Markdown"
          icon={<FileText />}
          busy={busy === "markdown"}
          onClick={() => void run("markdown")}
        >
          Export
        </BusyButton>
      </SettingsRow>

      <RestoreRow />
    </SettingsSection>
  );
}
