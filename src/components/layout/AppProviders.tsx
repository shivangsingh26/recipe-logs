"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { InboxSync } from "@/components/inbox/InboxSync";
import { TimerProvider } from "@/components/timers/TimerProvider";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { ToastProvider } from "@/components/ui/Toast";
import { recordNavigation } from "@/lib/navigation";
import { usePrefs } from "@/lib/prefs";
import { applyTheme, resolveTheme } from "@/lib/theme";

/** Keeps <html class="dark"> and the status-bar colour in sync with the theme preference. */
function ThemeController() {
  const { theme } = usePrefs();
  useEffect(() => {
    applyTheme(resolveTheme(theme));
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme("system"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);
  return null;
}

function NavigationTracker() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString();
  useEffect(() => {
    recordNavigation();
  }, [pathname, search]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <TimerProvider>
          <ThemeController />
          <Suspense fallback={null}>
            <NavigationTracker />
          </Suspense>
          <InboxSync />
          {children}
        </TimerProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
