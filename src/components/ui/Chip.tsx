import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Toggle state; rendered as aria-pressed. */
  selected?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
}

/** Toggleable pill (filters, category pickers, meal tags). */
export function Chip({ selected = false, icon, size = "md", className, type = "button", children, ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 active:scale-95 [&_svg]:shrink-0",
        size === "md" ? "h-9 px-3.5 text-sm [&_svg]:size-4" : "h-7 px-2.5 text-xs [&_svg]:size-3.5",
        selected ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  icon?: ReactNode;
}

const BADGE_TONES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-on-accent-soft",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/** Static, non-interactive pill (category labels, counts, metadata). */
export function Badge({ tone = "neutral", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0",
        BADGE_TONES[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
