"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookPlus, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useInstallPlatform, useStandalone } from "@/components/pwa/platform";
import { useToast } from "@/components/ui/Toast";
import { formatMegabytes, type BackupCounts } from "@/lib/backup";
import { db, restoreStarterRecipes } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { BusyButton } from "./BusyButton";
import { CountTiles } from "./CountTiles";
import { EraseDataButton } from "./EraseDataButton";
import { SettingsRow, SettingsSection } from "./SettingsSection";
import type { Exporter } from "./useExporter";
import { useStorageInfo } from "./useStorageInfo";

async function countRecords(): Promise<BackupCounts> {
  const [recipes, logs, photos] = await Promise.all([db.recipes.count(), db.logs.count(), db.photos.count()]);
  return { recipes, logs, photos };
}

function PersistRow({ persisted, onProtect }: { persisted: boolean | null; onProtect: () => Promise<boolean> }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);

  const protect = async () => {
    if (asking) return;
    setAsking(true);
    const granted = await onProtect();
    setAsking(false);
    // The button goes away once protected; keep focus on the row instead of the page.
    if (granted) rowRef.current?.focus();
  };

  if (persisted === true) {
    return (
      <SettingsRow ref={rowRef} label="Protected from clean-up" description="This browser won't clear your data to free up space.">
        <ShieldCheck aria-hidden className="size-5 text-success" />
      </SettingsRow>
    );
  }
  if (persisted === null) {
    return (
      <SettingsRow
        ref={rowRef}
        label="Protect from clean-up"
        description="Not available in this browser. Back up regularly to stay safe."
      />
    );
  }
  return (
    <SettingsRow
      ref={rowRef}
      label="Protect from clean-up"
      description="Stops the browser from clearing your data when space runs low."
    >
      <BusyButton variant="soft" busy={asking} onClick={() => void protect()}>
        Protect
      </BusyButton>
    </SettingsRow>
  );
}

export function DataSection({ exporter }: { exporter: Exporter }) {
  const toast = useToast();
  const counts = useLiveQuery(countRecords, []);
  const storage = useStorageInfo(counts ? `${counts.recipes}:${counts.logs}:${counts.photos}` : "");
  const platform = useInstallPlatform();
  const standalone = useStandalone();
  const [restoring, setRestoring] = useState(false);

  const protect = async () => {
    const granted = await storage.persist();
    if (granted) {
      toast.show({ title: "Your data is protected", tone: "success" });
    } else {
      toast.show({
        title: "The browser said no for now",
        description:
          platform === "ios" && !standalone
            ? "Add CulinaryLog to your Home Screen, then try again."
            : "Browsers allow this for apps you install or use often.",
      });
    }
    return granted;
  };

  const restoreStarters = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const added = await restoreStarterRecipes();
      toast.show(
        added > 0
          ? { title: `Added ${pluralize(added, "starter recipe")}`, tone: "success" }
          : { title: "Already in your vault", description: "Both starter recipes are still there." },
      );
    } catch {
      toast.show({ title: "Couldn't add the starter recipes", tone: "danger" });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SettingsSection title="Data & storage" className="divide-y divide-line">
      <div className="py-4">
        <CountTiles counts={counts} />
      </div>
      <SettingsRow label="Storage used" description="Recipes, photos and the offline copy of the app.">
        <span className="text-[15px] tabular-nums text-muted">
          {storage.usage === null ? "–" : formatMegabytes(storage.usage)}
        </span>
      </SettingsRow>
      <PersistRow persisted={storage.persisted} onProtect={protect} />
      <SettingsRow label="Starter recipes" description="Re-add the biryani and pepper chicken if you deleted them.">
        <BusyButton
          variant="secondary"
          aria-label="Restore starter recipes"
          icon={<BookPlus />}
          busy={restoring}
          onClick={() => void restoreStarters()}
        >
          Restore
        </BusyButton>
      </SettingsRow>
      <div className="py-4">
        <EraseDataButton exporter={exporter} counts={counts} />
      </div>
    </SettingsSection>
  );
}
