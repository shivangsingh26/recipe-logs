"use client";

import { CircleCheck, Download, Share, SquarePlus } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { promptInstall, useInstallPrompt } from "@/components/pwa/installPrompt";
import { useInstallPlatform, useStandalone } from "@/components/pwa/platform";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { SettingsRow, SettingsSection } from "./SettingsSection";
import { useHydrated } from "./useDeviceSupport";

const BENEFITS = "Opens full screen from its own icon, works offline, and keeps your data safer from clean-up.";

function Step({ n, icon, children }: { n: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-h-9 items-center gap-3 text-sm leading-snug text-ink">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted"
      >
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {icon && (
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent [&_svg]:size-[18px]"
        >
          {icon}
        </span>
      )}
    </li>
  );
}

function IosSteps() {
  return (
    <div className="py-4">
      <p className="text-[15px] font-medium text-ink">Add to your Home Screen</p>
      <p className="mt-0.5 text-sm leading-snug text-muted">{BENEFITS}</p>
      <ol aria-label="How to add CulinaryLog to your Home Screen" className="mt-3 flex flex-col gap-2">
        <Step n={1} icon={<Share />}>
          In Safari, tap <span className="font-semibold">Share</span> (on newer iPhones it&apos;s in the ••• menu).
        </Step>
        <Step n={2} icon={<SquarePlus />}>
          Choose <span className="font-semibold">Add to Home Screen</span>.
        </Step>
        <Step n={3}>
          Tap <span className="font-semibold">Add</span>, then open CulinaryLog from its new icon.
        </Step>
      </ol>
    </div>
  );
}

export function InstallSection() {
  const toast = useToast();
  const hydrated = useHydrated();
  const standalone = useStandalone();
  const platform = useInstallPlatform();
  const prompt = useInstallPrompt();
  const rowRef = useRef<HTMLDivElement>(null);

  const install = async () => {
    const outcome = await promptInstall();
    // The Install button is gone either way; keep focus in this section.
    rowRef.current?.focus();
    if (outcome === "accepted") toast.show({ title: "CulinaryLog is installed", tone: "success" });
  };

  let content: ReactNode;
  if (!hydrated) {
    content = (
      <div className="py-4">
        <Skeleton className="h-12" />
      </div>
    );
  } else if (standalone || prompt.installed) {
    content = (
      <SettingsRow ref={rowRef} label="Installed" description="CulinaryLog runs as an app on this device and works offline.">
        <CircleCheck aria-hidden className="size-5 text-success" />
      </SettingsRow>
    );
  } else if (platform === "ios") {
    content = <IosSteps />;
  } else if (prompt.available) {
    content = (
      <SettingsRow ref={rowRef} label="Install app" description={BENEFITS}>
        <Button icon={<Download />} onClick={() => void install()}>
          Install
        </Button>
      </SettingsRow>
    );
  } else {
    content = (
      <SettingsRow
        ref={rowRef}
        label="Install app"
        description={
          platform === "android"
            ? "Open the browser menu (⋮) and choose Install app or Add to Home screen."
            : "Use your browser's install option, in the address bar or menu, to add CulinaryLog as an app."
        }
      />
    );
  }

  return <SettingsSection title="Install">{content}</SettingsSection>;
}
