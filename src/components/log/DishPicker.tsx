"use client";

import { BookOpen, History, PenLine, Star, type LucideIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { useAllLogs } from "@/lib/db";
import { searchRecipes } from "@/lib/log/dishSearch";
import { recentRecipeIds } from "@/lib/log/stats";
import type { CookLog, Recipe } from "@/lib/types";

/** What was cooked: a vault recipe (recipeId set) or a custom dish (recipeId null). */
export interface DishChoice {
  recipeId: string | null;
  name: string;
}

export interface DishPickerProps {
  value: DishChoice | null;
  onChange: (choice: DishChoice | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  recipes: Recipe[] | undefined;
  error?: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
}

type Option =
  | { key: string; kind: "recipe"; recipe: Recipe; group: string; icon: LucideIcon }
  | { key: string; kind: "custom"; name: string; group: string; icon: LucideIcon };

const GROUP_LIMIT = 4;
const SEARCH_LIMIT = 6;
const NO_LOGS: CookLog[] = [];

function buildOptions(recipes: Recipe[], logs: CookLog[], query: string): Option[] {
  const q = query.trim();
  const recipeOption = (recipe: Recipe, group: string, icon: LucideIcon): Option => ({
    key: `recipe-${recipe.id}`,
    kind: "recipe",
    recipe,
    group,
    icon,
  });
  if (q) {
    return [
      ...searchRecipes(recipes, q, SEARCH_LIMIT).map((r) => recipeOption(r, "", BookOpen)),
      { key: "custom", kind: "custom", name: q, group: "", icon: PenLine },
    ];
  }
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const recent = recentRecipeIds(logs, GROUP_LIMIT).flatMap((id) => byId.get(id) ?? []);
  const recentIds = new Set(recent.map((r) => r.id));
  const favorites = recipes
    .filter((r) => r.favorite && !recentIds.has(r.id))
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, GROUP_LIMIT);
  const options = [
    ...recent.map((r) => recipeOption(r, "Recent", History)),
    ...favorites.map((r) => recipeOption(r, "Favorites", Star)),
  ];
  // A fresh vault has no history or favourites yet: offer the newest recipes instead.
  return options.length > 0 ? options : recipes.slice(0, GROUP_LIMIT + 1).map((r) => recipeOption(r, "Recipes", BookOpen));
}

/** Groups consecutive options by their group label (labels are "" for search results). */
function groupOptions(options: Option[]): Array<{ label: string; items: Array<{ option: Option; index: number }> }> {
  const groups: Array<{ label: string; items: Array<{ option: Option; index: number }> }> = [];
  options.forEach((option, index) => {
    const last = groups[groups.length - 1];
    if (last && last.label === option.group) last.items.push({ option, index });
    else groups.push({ label: option.group, items: [{ option, index }] });
  });
  return groups;
}

/** Combobox for the dish: recent/favourite recipes, vault search, or a custom dish name. */
export function DishPicker({ value, onChange, query, onQueryChange, recipes, error, inputRef }: DishPickerProps) {
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const logs = useAllLogs();
  const [active, setActive] = useState(-1);
  const changeRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<"input" | "change" | null>(null);
  const options = useMemo(() => buildOptions(recipes ?? [], logs ?? NO_LOGS, query), [recipes, logs, query]);
  const groups = useMemo(() => groupOptions(options), [options]);
  const optionId = (index: number) => `${id}-option-${index}`;
  const activeIndex = active < options.length ? active : -1;

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === "input") inputRef.current?.focus();
    else if (target === "change") changeRef.current?.focus();
  }, [value, inputRef]);

  const pick = (option: Option) => {
    focusAfter.current = "change";
    setActive(-1);
    onQueryChange("");
    onChange(
      option.kind === "recipe"
        ? { recipeId: option.recipe.id, name: option.recipe.title }
        : { recipeId: null, name: option.name },
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      if (activeIndex === -1) setActive(step > 0 ? 0 : options.length - 1);
      else setActive((activeIndex + step + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[activeIndex] ?? (query.trim() ? options[0] : undefined);
      if (option) pick(option);
    } else if (e.key === "Escape" && query) {
      // Clear the search first; a second Esc closes the sheet as usual.
      e.preventDefault();
      e.stopPropagation();
      onQueryChange("");
      setActive(-1);
    }
  };

  if (value) {
    const isRecipe = value.recipeId !== null;
    const Icon = isRecipe ? BookOpen : PenLine;
    return (
      <div className="flex flex-col gap-1.5">
        <p className="px-0.5 text-sm font-medium text-ink">What did you cook?</p>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-on-accent-soft">
            <Icon aria-hidden className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-serif text-[17px] font-semibold leading-snug text-ink">{value.name}</p>
            <p className="text-xs text-muted">{isRecipe ? "From your recipes" : "Custom dish"}</p>
          </div>
          <Button
            ref={changeRef}
            variant="secondary"
            aria-label={`Change dish (${value.name})`}
            onClick={() => {
              focusAfter.current = "input";
              onQueryChange(isRecipe ? "" : value.name);
              onChange(null);
            }}
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-input`} className="px-0.5 text-sm font-medium text-ink">
        What did you cook?
      </label>
      <TextInput
        id={`${id}-input`}
        ref={inputRef}
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder="Search recipes or type a dish"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setActive(e.target.value.trim() ? 0 : -1);
        }}
        onKeyDown={onKeyDown}
      />
      {error && (
        <p id={errorId} className="px-0.5 text-sm text-danger">
          {error}
        </p>
      )}
      <div id={listId} role="listbox" aria-label="Dishes" className="mt-1.5 space-y-3">
        {groups.map((group) => (
          <div
            key={group.label || "results"}
            role="group"
            aria-labelledby={group.label ? `${id}-${group.label}` : undefined}
            aria-label={group.label ? undefined : "Matches"}
          >
            {group.label && (
              <p
                id={`${id}-${group.label}`}
                className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted"
              >
                {group.label}
              </p>
            )}
            <div className="overflow-hidden rounded-2xl border border-line">
              {group.items.map(({ option, index }) => (
                <OptionRow
                  key={option.key}
                  id={optionId(index)}
                  option={option}
                  active={index === activeIndex}
                  onPick={() => pick(option)}
                  onHover={() => setActive(index)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {options.length === 0 && recipes !== undefined && (
        <p className="px-0.5 text-sm text-muted">Type the dish name. It doesn&rsquo;t need to be one of your recipes.</p>
      )}
    </div>
  );
}

interface OptionRowProps {
  id: string;
  option: Option;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}

function OptionRow({ id, option, active, onPick, onHover }: OptionRowProps) {
  const Icon = option.icon;
  const isCustom = option.kind === "custom";
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      // Keep focus (and the keyboard) on the input while choosing with a mouse.
      onMouseDown={(e) => e.preventDefault()}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") onHover();
      }}
      onClick={onPick}
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 border-line px-3.5 py-2 transition-colors [&:not(:first-child)]:border-t",
        active ? "bg-surface-2" : "bg-surface active:bg-surface-2",
      )}
    >
      <Icon aria-hidden className={cn("size-[18px] shrink-0", isCustom ? "text-accent" : "text-muted")} />
      <div className="min-w-0 flex-1">
        {option.kind === "recipe" ? (
          <>
            <p className="truncate text-[15px] font-medium text-ink">{option.recipe.title}</p>
            {option.recipe.categories.length > 0 && (
              <p className="truncate text-xs text-muted">{option.recipe.categories.slice(0, 3).join(" · ")}</p>
            )}
          </>
        ) : (
          <p className="text-[15px] font-medium text-ink">
            Use &ldquo;<span className="break-words">{option.name}</span>&rdquo; as a custom dish
          </p>
        )}
      </div>
    </div>
  );
}
