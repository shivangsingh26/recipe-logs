"use client";

import { ArchiveRestore } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { useToast } from "@/components/ui/Toast";
import { BackupError, loadBackup, summarizeRestore, type LoadedBackup, type RestoreResult } from "@/lib/backup";
import { BusyButton } from "./BusyButton";
import { focusWhenDialogsClose } from "./focus";
import { RestoreSheet } from "./RestoreSheet";
import { SettingsRow } from "./SettingsSection";

const ACCEPT = ".zip,.json,application/zip,application/json";

interface Pending {
  backup: LoadedBackup;
  fileName: string;
}

/** "Restore from backup": pick a file → preview sheet → restore → summary. */
export function RestoreRow() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  // Remounts the sheet for each new file so its mode choice starts fresh. It stays the same
  // while the sheet closes, so the dialog closes normally instead of being torn down.
  const [sheetKey, setSheetKey] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires onChange.
    event.target.value = "";
    if (!file) return;
    setReading(true);
    try {
      const backup = await loadBackup(file);
      setSheetKey((key) => key + 1);
      setPending({ backup, fileName: file.name });
    } catch (error) {
      toast.show({
        title: "Can't restore this file",
        description: error instanceof BackupError ? error.message : "It couldn't be read. Try another backup file.",
        tone: "danger",
      });
    } finally {
      setReading(false);
    }
  };

  const closeSheet = () => {
    setPending(null);
    // The file picker never focused the button, so the dialog has nothing to return focus to.
    focusWhenDialogsClose(buttonRef.current);
  };

  const onRestored = (result: RestoreResult) => {
    closeSheet();
    const text = summarizeRestore(result);
    setSummary(result.mode === "replace" ? `Replaced everything with the backup: ${text}` : text);
  };

  return (
    <div className="py-1">
      <SettingsRow label="Restore from backup" description="Load a .zip or .json backup from this or another device.">
        <BusyButton
          ref={buttonRef}
          variant="secondary"
          aria-label="Restore from backup"
          icon={<ArchiveRestore />}
          busy={reading}
          onClick={() => {
            if (!reading) inputRef.current?.click();
          }}
        >
          Restore
        </BusyButton>
      </SettingsRow>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-label="Backup file to restore"
        hidden
        onChange={(event) => void onFileChosen(event)}
      />
      {/* The toast announces the result; this line keeps it visible afterwards. */}
      <p className="text-sm leading-snug text-muted [&:not(:empty)]:pb-3">
        {summary && (
          <>
            <span className="font-medium text-success">Restored.</span> {summary}
          </>
        )}
      </p>
      <RestoreSheet
        key={sheetKey}
        open={pending !== null}
        backup={pending?.backup ?? null}
        fileName={pending?.fileName ?? ""}
        onClose={closeSheet}
        onRestored={onRestored}
      />
    </div>
  );
}
