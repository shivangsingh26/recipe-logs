"use client";

import { Search, X } from "lucide-react";
import { useId, type RefObject } from "react";
import { IconButton } from "@/components/ui/IconButton";

export interface VaultSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Lets the parent return focus here (e.g. after "Clear filters"). */
  inputRef: RefObject<HTMLInputElement | null>;
}

export function VaultSearchField({ value, onChange, inputRef }: VaultSearchFieldProps) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search recipes
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Results are already live; Enter just dismisses the on-screen keyboard.
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="Search recipes, ingredients, tags"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={
          "h-11 w-full rounded-xl border border-transparent bg-surface-2 pl-10 pr-11 text-base text-ink placeholder:text-subtle " +
          "transition-[border-color,box-shadow,background-color] focus:border-accent focus:bg-surface focus:outline-none " +
          "focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:appearance-none"
        }
      />
      {value && (
        <IconButton
          label="Clear search"
          className="absolute right-0 top-0"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <X aria-hidden className="!size-[18px] text-muted" />
        </IconButton>
      )}
    </div>
  );
}
