import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

/** Extra classes for cards that are links/buttons: pressed feedback + hover border. */
export const cardInteractive =
  "transition-[transform,border-color,background-color] duration-150 hover:border-line-strong active:scale-[0.99] active:bg-surface-2";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function Card({ className, ref, ...rest }: CardProps) {
  return <div ref={ref} className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...rest} />;
}

/** Small uppercase label above a group of content. */
export function SectionLabel({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted", className)} {...rest} />;
}
