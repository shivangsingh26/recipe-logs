"use client";

import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useBack } from "@/lib/navigation";
import { IconButton } from "./IconButton";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Shows a back button; goes back in history, or to this href when there is none. */
  backHref?: string;
  /** Trailing buttons (IconButtons work best). */
  actions?: ReactNode;
  /** Extra row under the title: search field, filters, segmented control … */
  children?: ReactNode;
  /** "large" = serif tab title; "compact" = detail/edit pages. */
  size?: "large" | "compact";
  className?: string;
}

/** Sticky, translucent page header that respects the iPhone notch/status bar. */
export function PageHeader({ title, subtitle, backHref, actions, children, size = "large", className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-line/70 bg-canvas/85 pt-safe backdrop-blur-xl backdrop-saturate-150",
        className,
      )}
    >
      <div className={cn("flex items-center gap-1 px-2", size === "large" ? "min-h-16 pt-2" : "min-h-14")}>
        {backHref ? <BackButton href={backHref} /> : <div className="w-2" />}
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              "truncate text-ink",
              size === "large"
                ? "font-serif text-[28px] font-semibold leading-tight tracking-tight"
                : "text-[17px] font-semibold leading-tight",
            )}
          >
            {title}
          </h1>
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-0.5 pr-1">{actions}</div>}
      </div>
      {children && <div className="px-4 pb-3">{children}</div>}
    </header>
  );
}

function BackButton({ href }: { href: string }) {
  const back = useBack(href);
  return (
    <IconButton label="Back" onClick={back} className="-mr-1">
      <ChevronLeft className="!size-7" />
    </IconButton>
  );
}
