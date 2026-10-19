"use client";

import { BookOpen, ClipboardPaste, Plus, SearchX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Fab } from "@/components/ui/Fab";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { hasCategory } from "@/lib/categories";
import { useRecipes, useRecipeStats, useUsedCategories } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { NEW_RECIPE_HREF } from "@/lib/recipes/links";
import { filterCategory, isFiltered, queryRecipes, type VaultQuery } from "@/lib/recipes/query";
import { loadVaultScroll, saveVaultScroll, useVaultQuery } from "@/lib/recipes/viewState";
import { RecipeCard } from "./RecipeCard";
import { VaultFilterBar } from "./VaultFilterBar";
import { VaultSearchField } from "./VaultSearchField";

/** The recipe vault ("/"): search, filter chips, sort and the recipe cards. */
export function VaultScreen() {
  const recipes = useRecipes();
  const stats = useRecipeStats();
  const categories = useUsedCategories();
  const [stored, updateQuery] = useVaultQuery();
  const searchRef = useRef<HTMLInputElement>(null);

  // A remembered category whose last recipe is gone falls back to "All".
  const storedCategory = filterCategory(stored.filter);
  const stale = recipes !== undefined && storedCategory !== null && !hasCategory(categories, storedCategory);
  const query = useMemo<VaultQuery>(() => (stale ? { ...stored, filter: "all" } : stored), [stale, stored]);

  const results = useMemo(
    () => (recipes && stats ? queryRecipes(recipes, query, stats) : undefined),
    [recipes, stats, query],
  );
  const total = recipes?.length;
  useVaultScrollMemory(results !== undefined);

  const clearFilters = () => {
    updateQuery({ search: "", filter: "all" });
    searchRef.current?.focus();
  };

  return (
    <>
      <PageHeader title="Recipes" subtitle={total === undefined ? " " : pluralize(total, "recipe")}>
        {total !== 0 && (
          <>
            <VaultSearchField value={query.search} onChange={(search) => updateQuery({ search })} inputRef={searchRef} />
            <VaultFilterBar
              categories={categories}
              filter={query.filter}
              sort={query.sort}
              onFilterChange={(filter) => updateQuery({ filter })}
              onSortChange={(sort) => updateQuery({ sort })}
            />
          </>
        )}
      </PageHeader>
      <main className="px-4 pb-nav pt-4">
        <p aria-live="polite" className="sr-only">
          {results && isFiltered(query) ? `${pluralize(results.length, "recipe")} found` : ""}
        </p>
        {results === undefined ? (
          <VaultSkeleton />
        ) : total === 0 ? (
          <EmptyVault />
        ) : results.length === 0 ? (
          <EmptyState
            icon={<SearchX aria-hidden />}
            title="No matches"
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          >
            Try another word, or show every recipe.
          </EmptyState>
        ) : (
          <ul aria-label="Recipes" className="space-y-3">
            {results.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} stats={stats?.get(recipe.id)} />
            ))}
          </ul>
        )}
      </main>
      {total !== 0 && <Fab href={NEW_RECIPE_HREF} label="New recipe" icon={<Plus aria-hidden />} />}
    </>
  );
}

/** Restores the list's scroll position once the cards have rendered, and keeps it up to date. */
function useVaultScrollMemory(ready: boolean): void {
  const [savedY] = useState(loadVaultScroll);
  const restored = useRef(false);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    if (savedY > 0) window.scrollTo(0, savedY);
  }, [ready, savedY]);

  useEffect(() => {
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (restored.current) saveVaultScroll(window.scrollY);
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, []);
}

function EmptyVault() {
  return (
    <EmptyState
      icon={<BookOpen aria-hidden />}
      title="Your recipe vault is empty"
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={NEW_RECIPE_HREF} icon={<Plus aria-hidden />}>
            New recipe
          </ButtonLink>
          <ButtonLink href="/import/" variant="secondary" icon={<ClipboardPaste aria-hidden />}>
            Import
          </ButtonLink>
        </div>
      }
    >
      Write down a dish you love, or paste one from a website or your notes.
    </EmptyState>
  );
}

function VaultSkeleton() {
  return (
    <ul aria-hidden className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex gap-3.5 rounded-2xl border border-line bg-surface p-3">
          <Skeleton className="size-[68px] shrink-0" />
          <div className="flex-1 space-y-2.5 py-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
