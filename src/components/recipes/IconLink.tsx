import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconLinkProps {
  href: string;
  /** Accessible name and tooltip. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** A next/link that looks like a ghost IconButton (44px round target). */
export function IconLink({ href, label, children, className }: IconLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-[background-color,transform] duration-150",
        "hover:bg-surface-2 active:scale-90 [&_svg]:size-[22px] [&_svg]:shrink-0",
        className,
      )}
    >
      {children}
    </Link>
  );
}
