"use client";

import { History } from "lucide-react";
import type { Ref } from "react";
import { Badge } from "@/components/ui/Chip";
import { formatAgo } from "@/lib/dates";
import { usePhotoUrl } from "@/lib/db";
import type { Recipe, RecipeStats } from "@/lib/types";

export interface RecipeHeroProps {
  recipe: Recipe;
  stats?: RecipeStats;
  /** The large title; the page header fades its own title in once this scrolls away. */
  titleRef?: Ref<HTMLParagraphElement>;
}

/** Latest plate photo, big title, description, categories and the "cooked N times" line. */
export function RecipeHero({ recipe, stats, titleRef }: RecipeHeroProps) {
  const photoUrl = usePhotoUrl(stats?.coverPhotoId ?? null, "full");
  return (
    <div className="px-4 pt-3">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB; next/image can't optimise it
        <img src={photoUrl} alt="" className="mb-4 aspect-[4/3] w-full rounded-2xl bg-surface-2 object-cover" />
      )}
      {/* The header's h1 carries the title for assistive tech; this is its large visual twin. */}
      <p
        ref={titleRef}
        aria-hidden
        className="text-balance font-serif text-[28px] font-semibold leading-tight tracking-tight text-ink"
      >
        {recipe.title}
      </p>
      {recipe.description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{recipe.description}</p>}
      {recipe.categories.length > 0 && (
        <ul aria-label="Categories" className="mt-3 flex flex-wrap gap-1.5">
          {recipe.categories.map((category) => (
            <li key={category}>
              <Badge>{category}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
        <History aria-hidden className="size-4 shrink-0" />
        {cookedSummary(stats)}
      </p>
    </div>
  );
}

function cookedSummary(stats: RecipeStats | undefined): string {
  if (!stats || stats.count === 0) return "Not cooked yet";
  if (!stats.lastDate) return `Cooked ${pluralTimes(stats.count)}`;
  const ago = formatAgo(stats.lastDate);
  if (stats.count === 1) return `Cooked once · ${ago}`;
  const last = ago === "today" || ago === "yesterday" ? `last cooked ${ago}` : `last ${ago}`;
  return `Cooked ${pluralTimes(stats.count)} · ${last}`;
}

function pluralTimes(count: number): string {
  if (count === 1) return "once";
  if (count === 2) return "twice";
  return `${count} times`;
}
