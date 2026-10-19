"use client";

import { CalendarPlus, Ellipsis, Pencil } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { LogDishSheet } from "@/components/log/LogDishSheet";
import { RecipeCookHistory } from "@/components/log/RecipeCookHistory";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { useCookState, useRecipeStats } from "@/lib/db";
import { editRecipeHref } from "@/lib/recipes/links";
import { useRecipeTab, type RecipeTab } from "@/lib/recipes/viewState";
import type { Recipe } from "@/lib/types";
import { CookModeToggle } from "./CookModeToggle";
import { FavoriteButton } from "./FavoriteButton";
import { IconLink } from "./IconLink";
import { IngredientsPanel } from "./IngredientsPanel";
import { MacrosCard } from "./MacrosCard";
import { NotesPanel } from "./NotesPanel";
import { RecipeActionsSheet } from "./RecipeActionsSheet";
import { RecipeFacts } from "./RecipeFacts";
import { RecipeHero } from "./RecipeHero";
import { StepsPanel } from "./StepsPanel";
import { useDocumentTitle } from "./useDocumentTitle";

export interface RecipeDetailProps {
  recipe: Recipe;
  /** Called right before the recipe is deleted. */
  onDeleting: () => void;
}

/** A loaded recipe: hero, facts, macros, "Log this dish", cook mode and the four tabs. */
export function RecipeDetail({ recipe, onDeleting }: RecipeDetailProps) {
  const stats = useRecipeStats()?.get(recipe.id);
  const cook = useCookState(recipe.id);
  const [tab, setTab] = useRecipeTab(recipe.id);
  const [logOpen, setLogOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showHeaderTitle = useScrolledPast(titleRef);
  useDocumentTitle(recipe.title);

  const options: ReadonlyArray<SegmentOption<RecipeTab>> = [
    {
      value: "ingredients",
      label: <TabLabel text="Ingredients" done={countIn(recipe.ingredients, cook.checkedIngredientIds)} total={recipe.ingredients.length} />,
    },
    { value: "steps", label: <TabLabel text="Steps" done={countIn(recipe.steps, cook.doneStepIds)} total={recipe.steps.length} /> },
    { value: "notes", label: "Notes" },
    { value: "history", label: "History" },
  ];

  const changeTab = (next: RecipeTab) => {
    setTab(next);
    // When the tabs are stuck under the header, show the new panel from its start.
    const tabs = tabsRef.current;
    const panel = panelRef.current;
    if (!tabs || !panel) return;
    const overlap = tabs.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
    if (overlap > 1) window.scrollBy({ top: -overlap });
  };

  return (
    <>
      <PageHeader
        size="compact"
        backHref="/"
        title={
          // Block + truncate so the ellipsis belongs to the span and fades with it.
          <span className={cn("block truncate transition-opacity duration-200", showHeaderTitle ? "opacity-100" : "opacity-0")}>
            {recipe.title}
          </span>
        }
        actions={
          <>
            <FavoriteButton recipeId={recipe.id} favorite={recipe.favorite} />
            <IconLink href={editRecipeHref(recipe.id)} label="Edit recipe">
              <Pencil aria-hidden />
            </IconLink>
            <IconButton label="More actions" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
              <Ellipsis aria-hidden />
            </IconButton>
          </>
        }
      />
      <main className="pb-nav">
        <RecipeHero recipe={recipe} stats={stats} titleRef={titleRef} />
        <div className="mt-5 space-y-3 px-4">
          <RecipeFacts recipe={recipe} />
          <MacrosCard macros={recipe.macros} />
          <Button size="lg" fullWidth icon={<CalendarPlus aria-hidden />} onClick={() => setLogOpen(true)}>
            Log this dish
          </Button>
          <CookModeToggle />
        </div>
        <div
          ref={tabsRef}
          className="sticky top-[calc(env(safe-area-inset-top)+57px)] z-20 mt-6 bg-canvas/85 px-4 py-2 backdrop-blur-xl backdrop-saturate-150"
        >
          {/* Segments sized to their labels, so "Ingredients 12/27" fits beside the short ones. */}
          <SegmentedControl
            label="Recipe sections"
            value={tab}
            onChange={changeTab}
            options={options}
            className="[&>button]:flex-auto [&>button]:px-2"
          />
        </div>
        <div ref={panelRef} className="px-4 pt-1">
          {tab === "ingredients" && <IngredientsPanel recipe={recipe} checkedIds={cook.checkedIngredientIds} />}
          {tab === "steps" && <StepsPanel recipe={recipe} doneIds={cook.doneStepIds} />}
          {tab === "notes" && <NotesPanel recipe={recipe} />}
          {tab === "history" && <RecipeCookHistory recipeId={recipe.id} />}
        </div>
      </main>
      <LogDishSheet open={logOpen} onClose={() => setLogOpen(false)} initialRecipeId={recipe.id} />
      <RecipeActionsSheet open={moreOpen} onClose={() => setMoreOpen(false)} recipe={recipe} onDeleting={onDeleting} />
    </>
  );
}

function countIn(items: ReadonlyArray<{ id: string }>, ids: readonly string[]): number {
  const set = new Set(ids);
  return items.reduce((n, item) => n + (set.has(item.id) ? 1 : 0), 0);
}

function TabLabel({ text, done, total }: { text: string; done: number; total: number }) {
  if (total === 0) return <>{text}</>;
  return (
    <>
      {text}
      <span
        aria-hidden
        className={cn("text-[11px] font-semibold tabular-nums", done === total ? "text-accent" : "text-muted")}
      >
        {done}/{total}
      </span>
      <span className="sr-only">
        , {done} of {total} done
      </span>
    </>
  );
}

/** True once the element has scrolled up under the sticky header. */
function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < 64),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}
