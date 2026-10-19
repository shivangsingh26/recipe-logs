"use client";

import { BellRing } from "lucide-react";
import { useRef, useState } from "react";
import { useInstallPlatform, useStandalone } from "@/components/pwa/platform";
import { useToast } from "@/components/ui/Toast";
import { BusyButton } from "./BusyButton";
import { SettingsRow } from "./SettingsSection";
import { requestNotificationPermission, useNotificationStatus } from "./useNotificationPermission";

const LABEL = "Timer alerts";

/** Notification permission for finished timers: status, "Enable", and the iPhone hint. */
export function TimerAlertsRow() {
  const toast = useToast();
  const status = useNotificationStatus();
  const platform = useInstallPlatform();
  const standalone = useStandalone();
  const rowRef = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);
  // iOS only offers notifications to web apps opened from the Home Screen.
  const iosHint = platform === "ios" && !standalone ? " On iPhone, add to Home Screen first." : "";

  const enable = async () => {
    if (asking) return;
    setAsking(true);
    const next = await requestNotificationPermission();
    setAsking(false);
    if (next !== "default") rowRef.current?.focus();
    if (next === "granted") toast.show({ title: "Timer alerts are on", tone: "success" });
    else if (next === "denied") toast.show({ title: "Notifications are blocked", description: "Allow them in your device settings." });
  };

  if (status === "granted") {
    return (
      <SettingsRow ref={rowRef} label={LABEL} description="You'll get an alert when a timer ends, even in another app.">
        <span className="text-sm font-medium text-success">On</span>
      </SettingsRow>
    );
  }
  if (status === "denied") {
    return (
      <SettingsRow ref={rowRef} label={LABEL} description="Blocked. Allow notifications for CulinaryLog in your device settings.">
        <span className="text-sm font-medium text-muted">Off</span>
      </SettingsRow>
    );
  }
  if (status === "unsupported") {
    return (
      <SettingsRow
        ref={rowRef}
        label={LABEL}
        description={iosHint ? `Get an alert when a timer ends.${iosHint}` : "Not supported by this browser."}
      />
    );
  }
  return (
    <SettingsRow ref={rowRef} label={LABEL} description={`Get an alert when a timer ends while you're in another app.${iosHint}`}>
      <BusyButton variant="soft" icon={<BellRing />} busy={asking} onClick={() => void enable()}>
        Enable
      </BusyButton>
    </SettingsRow>
  );
}
