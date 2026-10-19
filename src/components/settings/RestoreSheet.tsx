"use client";

import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Chip";
import { useConfirm } from "@/components/ui/Confirm";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import {
  backupCounts,
  describeBackupDate,
  restoreBackup,
  summarizeRestore,
  type LoadedBackup,
  type RestoreMode,
  type RestoreResult,
} from "@/lib/backup";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { BusyButton } from "./BusyButton";
import { CountTiles } from "./CountTiles";

export interface RestoreSheetProps {
  open: boolean;
  backup: LoadedBackup | null;
  fileName: string;
  onClose: () => void;
  onRestored: (result: RestoreResult) => void;
}

interface ModeOptionProps {
  value: RestoreMode;
  selected: boolean;
  onSelect: (mode: RestoreMode) => void;
  title: string;
  description: string;
  badge?: string;
  danger?: boolean;
}

function ModeOption({ value, selected, onSelect, title, description, badge, danger }: ModeOptionProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer gap-3 rounded-2xl border p-4 transition-colors duration-150",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        !selected && "border-line",
        selected && (danger ? "border-danger bg-danger-soft" : "border-accent bg-accent-soft/50"),
      )}
    >
      <input
        type="radio"
        name="restore-mode"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? (danger ? "border-danger" : "border-accent") : "border-line-strong",
        )}
      >
        {selected && <span className={cn("size-2.5 rounded-full", danger ? "bg-danger" : "bg-accent")} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-ink">
          <span id={titleId}>{title}</span>
          {badge && <Badge tone="accent">{badge}</Badge>}
        </span>
        <span id={descriptionId} className="mt-0.5 block text-sm leading-snug text-muted">
          {description}
        </span>
      </span>
    </label>
  );
}

/** Preview of a loaded backup with the merge/replace choice. */
export function RestoreSheet({ open, backup, fileName, onClose, onRestored }: RestoreSheetProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [working, setWorking] = useState(false);

  const restore = async () => {
    if (!backup || working) return;
    if (mode === "replace") {
      const ok = await confirm({
        title: "Replace everything?",
        body: "Every recipe, log entry and photo on this device will be deleted and replaced with this backup. This can't be undone.",
        confirmLabel: "Replace all",
        tone: "danger",
      });
      if (!ok) return;
    }
    setWorking(true);
    try {
      const result = await restoreBackup(backup, mode);
      toast.show({ title: "Backup restored", description: summarizeRestore(result), tone: "success" });
      onRestored(result);
    } catch {
      // The restore runs in one transaction, so a failure leaves the data as it was.
      toast.show({ title: "Restore failed", description: "Nothing was changed on this device.", tone: "danger" });
    } finally {
      setWorking(false);
    }
  };

  const counts = backup ? backupCounts(backup) : null;
  const date = backup ? describeBackupDate(backup.exportedAt) : null;
  const notes = backup
    ? [
        backup.missingPhotos > 0 &&
          `${pluralize(backup.missingPhotos, "log entry", "log entries")} mention a photo that isn't in this file.`,
        backup.dropped > 0 && `${pluralize(backup.dropped, "damaged record")} will be skipped.`,
        ...backup.warnings,
      ].filter((note): note is string => typeof note === "string" && note.length > 0)
    : [];

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!working) onClose();
      }}
      title="Restore backup"
      description={fileName}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" disabled={working} onClick={onClose}>
            Cancel
          </Button>
          <BusyButton
            variant={mode === "replace" ? "danger" : "primary"}
            className="flex-1"
            busy={working}
            onClick={() => void restore()}
          >
            {mode === "replace" ? "Replace all" : "Restore"}
          </BusyButton>
        </div>
      }
    >
      {counts && (
        <div className="flex flex-col gap-5 pt-1">
          <div>
            <CountTiles counts={counts} />
            <p className="mt-2.5 text-sm text-muted">{date ? `Backed up ${date}` : "Backup date unknown"}</p>
          </div>

          {notes.length > 0 && (
            <ul className="flex flex-col gap-1.5 rounded-xl bg-warning-soft px-3 py-2.5 text-sm leading-snug text-ink">
              {notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                  {note}
                </li>
              ))}
            </ul>
          )}

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[15px] font-semibold text-ink">How should it be restored?</legend>
            <ModeOption
              value="merge"
              selected={mode === "merge"}
              onSelect={setMode}
              title="Merge"
              badge="Recommended"
              description="Adds what's missing and keeps the newer copy of anything on both. Nothing is deleted."
            />
            <ModeOption
              value="replace"
              selected={mode === "replace"}
              onSelect={setMode}
              title="Replace all"
              danger
              description="Deletes everything on this device first, then loads the backup."
            />
          </fieldset>
        </div>
      )}
    </Sheet>
  );
}
