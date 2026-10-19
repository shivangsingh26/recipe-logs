"use client";

import { useCallback, useRef, useState } from "react";
import { useToast, type ToastApi } from "@/components/ui/Toast";
import {
  createExportFile,
  deliverFile,
  downloadFile,
  formatMegabytes,
  recordBackup,
  type DeliveryOutcome,
  type ExportKind,
  type ExportOptions,
} from "@/lib/backup";

const DONE_TITLE: Record<ExportKind, string> = {
  zip: "Backup saved",
  json: "JSON exported",
  markdown: "Markdown exported",
};

export interface Exporter {
  /** The export being prepared or handed off right now, if any. */
  busy: ExportKind | null;
  /** Builds the file and opens the share sheet (or downloads it). Resolves true once delivered. */
  run: (kind: ExportKind, options?: ExportOptions) => Promise<boolean>;
}

function handleOutcome(toast: ToastApi, kind: ExportKind, file: File, outcome: DeliveryOutcome): boolean {
  if (outcome === "shared" || outcome === "downloaded") {
    recordBackup(kind);
    toast.show({ title: DONE_TITLE[kind], description: `${file.name} · ${formatMegabytes(file.size)}`, tone: "success" });
    return true;
  }
  if (outcome === "needs-tap") {
    // Building a big export outlasted the tap, and share sheets need a fresh one.
    toast.show({
      id: "export-ready",
      title: "Your file is ready",
      description: "Tap Save to choose where it goes.",
      duration: 20_000,
      action: {
        label: "Save",
        onClick: () => {
          void deliverFile(file).then((next) => {
            if (next !== "needs-tap") return handleOutcome(toast, kind, file, next);
            downloadFile(file);
            return handleOutcome(toast, kind, file, "downloaded");
          });
        },
      },
    });
  }
  // "cancelled": the person closed the share sheet on purpose; nothing to say.
  return false;
}

/** Shared by every export button so only one export runs at a time. */
export function useExporter(): Exporter {
  const toast = useToast();
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (kind: ExportKind, options?: ExportOptions) => {
      if (running.current) return false;
      running.current = true;
      setBusy(kind);
      try {
        const file = await createExportFile(kind, options);
        return handleOutcome(toast, kind, file, await deliverFile(file));
      } catch {
        toast.show({ title: "Couldn't create the export", description: "Nothing was changed. Please try again.", tone: "danger" });
        return false;
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [toast],
  );

  return { busy, run };
}
