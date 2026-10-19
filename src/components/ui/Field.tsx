"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, stacked. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label != null && (
        <label htmlFor={htmlFor} className="px-0.5 text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="px-0.5 text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="px-0.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shared look for text-like controls. 16px text prevents iOS focus-zoom. */
export const inputClasses =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-subtle " +
  "transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 " +
  "disabled:opacity-60 aria-[invalid=true]:border-danger";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({ className, ref, ...rest }: TextInputProps) {
  return <input ref={ref} className={cn(inputClasses, "h-12", className)} {...rest} />;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with content instead of scrolling (default true). */
  autoGrow?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextArea({ className, autoGrow = true, rows = 3, ref, value, onInput, ...rest }: TextAreaProps) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  useLayoutEffect(resize, [value, autoGrow]);

  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      rows={rows}
      value={value}
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      className={cn(inputClasses, "block min-h-24 resize-none py-3 leading-relaxed", className)}
      {...rest}
    />
  );
}

function formatNumberValue(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseNumberText(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Unit shown inside the field on the right, e.g. "min", "g", "kcal". */
  suffix?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Numeric field using a decimal keypad. Keeps the raw text while typing (so "1." or ""
 * are possible mid-edit) and reports parsed numbers (null when empty/invalid).
 */
export function NumberInput({ value, onValueChange, suffix, className, ref, ...rest }: NumberInputProps) {
  const [text, setText] = useState(formatNumberValue(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    // External change (e.g. form reset): adopt it unless it's what the text already says.
    setPrevValue(value);
    if (parseNumberText(text) !== value) setText(formatNumberValue(value));
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.,]/g, "");
          setText(next);
          const parsed = parseNumberText(next);
          setPrevValue(parsed);
          onValueChange(parsed);
        }}
        className={cn(inputClasses, "h-12 tabular-nums", suffix && "pr-14", className)}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}
