"use client";

import { Check, DatabaseBackup, Trash } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { eraseAllData, formatCounts, type BackupCounts } from "@/lib/backup";
import { BusyButton } from "./BusyButton";
import { focusWhenDialogsClose } from "./focus";
import type { Exporter } from "./useExporter";

export interface EraseDataButtonProps {
  exporter: Exporter;
  counts: BackupCounts | undefined;
}

/** "Erase all data", confirmed twice: a sheet that offers a backup first, then a final danger confirm. */
export function EraseDataButton({ exporter, counts }: EraseDataButtonProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const eraseRef = useRef<HTMLButtonElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [erasing, setErasing] = useState(false);

  const backUpFirst = async () => {
    if (backedUp || !(await exporter.run("zip"))) return;
    setBackedUp(true);
    // "Back up first" turns into a disabled "Backed up"; the next step is erasing.
    eraseRef.current?.focus();
  };

  const closeSheet = () => {
    setSheetOpen(false);
    focusWhenDialogsClose(triggerRef.current);
  };

  const erase = async () => {
    setSheetOpen(false);
    const ok = await confirm({
      title: "Erase everything for good?",
      body: "There is no undo. Every recipe, log entry and photo on this device is deleted. Your preferences stay.",
      confirmLabel: "Erase all data",
      tone: "danger",
    });
    if (!ok) {
      focusWhenDialogsClose(triggerRef.current);
      return;
    }
    setErasing(true);
    try {
      await eraseAllData();
      toast.show({ title: "All data erased", description: "Restore a backup or start fresh." });
    } catch {
      toast.show({ title: "Couldn't erase data", description: "Nothing was deleted. Please try again.", tone: "danger" });
    } finally {
      setErasing(false);
      focusWhenDialogsClose(triggerRef.current);
    }
  };

  return (
    <>
      <BusyButton
        ref={triggerRef}
        variant="secondary"
        fullWidth
        icon={<Trash />}
        busy={erasing}
        className="text-danger"
        onClick={() => {
          if (erasing) return;
          setBackedUp(false);
          setSheetOpen(true);
        }}
      >
        Erase all data
      </BusyButton>
      <Sheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Erase all data?"
        footer={
          <div className="flex gap-3">
            <BusyButton
              variant="secondary"
              className="flex-1"
              icon={backedUp ? <Check /> : <DatabaseBackup />}
              busy={exporter.busy === "zip"}
              disabled={backedUp}
              onClick={() => void backUpFirst()}
            >
              {backedUp ? "Backed up" : "Back up first"}
            </BusyButton>
            <Button ref={eraseRef} variant="danger" className="flex-1" onClick={() => void erase()}>
              Erase…
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted">
          <p>
            This deletes {counts ? formatCounts(counts) : "every recipe, log entry and photo"} from this device.
            Nothing is kept anywhere else.
          </p>
          <p>
            If you might want them later, <span className="font-medium text-ink">back up first</span>. You can restore
            the backup here or on another phone.
          </p>
        </div>
      </Sheet>
    </>
  );
}
