import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Skeleton";

export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  soft: "bg-accent-soft text-on-accent-soft hover:bg-accent-soft/70",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:bg-danger/90 dark:text-canvas",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-sm [&_svg]:size-4",
  md: "h-11 gap-2 rounded-xl px-4 text-[15px] [&_svg]:size-[18px]",
  lg: "h-12 gap-2 rounded-xl px-5 text-base [&_svg]:size-5",
};

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Class string for anything that should look like a button (e.g. a Link). */
export function buttonClasses({ variant = "primary", size = "md", fullWidth, className }: ButtonStyleProps = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
    "transition-[background-color,border-color,color,transform,opacity] duration-150 active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    // Full-width buttons may shrink, so two of them share a flex row equally. (Not flex-1:
    // a zero flex-basis would collapse their height inside a flex column.)
    fullWidth ? "w-full min-w-0 shrink" : "shrink-0",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  /** Leading icon (a lucide-react element). Replaced by a spinner while `loading`. */
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  icon,
  iconRight,
  loading = false,
  disabled,
  type = "button",
  children,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">, ButtonStyleProps {
  href: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

/** A next/link styled as a button. */
export function ButtonLink({ href, variant, size, fullWidth, className, icon, iconRight, children, ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}
