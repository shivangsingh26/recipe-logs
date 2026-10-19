"use client";

import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { isWakeLockSupported, useWakeLock } from "@/lib/wakeLock";

const subscribeNever = () => () => {};

/** "Keep screen on" for this visit only (off by default); hidden where the Wake Lock API is missing. */
export function CookModeToggle() {
  const supported = useSyncExternalStore(subscribeNever, isWakeLockSupported, () => false);
  const [enabled, setEnabled] = useState(false);
  useWakeLock(enabled);
  if (!supported) return null;
  return (
    <Card className="px-4 py-1.5">
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        label="Keep screen on"
        description="Stops the screen dimming while you cook."
      />
    </Card>
  );
}
