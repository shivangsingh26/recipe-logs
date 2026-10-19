import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FabBaseProps {
  label: string;
  icon: ReactNode;
  /** Hide the text label (icon-only round button); label stays the accessible name. */
  iconOnly?: boolean;
  className?: string;
}

type FabProps = FabBaseProps & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

/**
 * Floating primary action, bottom-right of the content column, above the
 * bottom nav and the timer dock.
 */
export function Fab({ label, icon, iconOnly, className, ...action }: FabProps) {
  const classes = cn(
    "pointer-events-auto inline-flex h-14 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-on-accent shadow-float",
    "transition-[transform,background-color] duration-150 hover:bg-accent-hover active:scale-95 [&_svg]:size-6",
    iconOnly ? "w-14" : "pl-4 pr-5 text-[15px]",
    className,
  );
  const content = (
    <>
      {icon}
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </>
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-above-nav z-40">
      <div className="mx-auto flex w-full max-w-2xl justify-end px-4">
        {action.href !== undefined ? (
          <Link href={action.href} className={classes} aria-label={iconOnly ? label : undefined}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={classes} aria-label={iconOnly ? label : undefined}>
            {content}
          </button>
        )}
      </div>
    </div>
  );
}
