"use client";

import { BookOpen, CalendarDays, ClipboardPaste, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "Recipes", icon: BookOpen, match: (p) => p === "/" || p.startsWith("/recipe") },
  { href: "/log/", label: "Cook Log", icon: CalendarDays, match: (p) => p.startsWith("/log") },
  { href: "/import/", label: "Import", icon: ClipboardPaste, match: (p) => p.startsWith("/import") },
  { href: "/settings/", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") },
];

/** Full-screen forms hide the tab bar (they have their own sticky action bar). */
function isHiddenOn(path: string): boolean {
  return path.startsWith("/recipe/edit");
}

export function BottomNav() {
  const pathname = usePathname() || "/";
  const hidden = isHiddenOn(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (hidden) root.dataset.nav = "hidden";
    else delete root.dataset.nav;
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-safe backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto grid h-[var(--nav-h)] max-w-2xl grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:opacity-60",
                  active ? "text-accent" : "text-muted hover:text-ink",
                )}
              >
                <Icon aria-hidden className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
