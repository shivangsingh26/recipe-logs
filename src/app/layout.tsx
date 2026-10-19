import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "@/components/layout/AppProviders";
import { BottomNav } from "@/components/layout/BottomNav";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { TimerDock } from "@/components/timers/TimerDock";
import { withBasePath } from "@/lib/basePath";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";

const DESCRIPTION = "Your personal recipe vault and daily cook log. Works offline; your data stays on your device.";

export const metadata: Metadata = {
  title: { default: "CulinaryLog", template: "%s · CulinaryLog" },
  description: DESCRIPTION,
  applicationName: "CulinaryLog",
  manifest: withBasePath("/manifest.webmanifest"),
  icons: {
    icon: [
      { url: withBasePath("/icons/icon.svg"), type: "image/svg+xml" },
      { url: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: withBasePath("/icons/apple-touch-icon.png"), sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "CulinaryLog", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: shrink the layout viewport when the keyboard opens so sheets stay visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">
        <AppProviders>
          <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">{children}</div>
          <TimerDock />
          <BottomNav />
          <ServiceWorkerRegistrar />
        </AppProviders>
      </body>
    </html>
  );
}
