import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

type IconButtonVariant = "ghost" | "secondary" | "soft" | "primary";

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: "text-ink hover:bg-surface-2",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  soft: "bg-accent-soft text-on-accent-soft hover:bg-accent-soft/70",
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also used as the tooltip. Required: icon-only buttons need one. */
  label: string;
  variant?: IconButtonVariant;
  /** md = 44px (default touch target), sm = 36px for dense rows. */
  size?: "sm" | "md";
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  children,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,transform,opacity] duration-150",
        "active:scale-90 disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
        size === "md" ? "size-11 [&_svg]:size-[22px]" : "size-9 [&_svg]:size-[18px]",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
