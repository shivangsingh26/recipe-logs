"use client";

import { ChefHat, Clock, Dumbbell, Flame, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, cardInteractive } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { formatAgo } from "@/lib/dates";
import { usePhotoUrl } from "@/lib/db";
import { formatMinutes, formatNumber, totalMinutes } from "@/lib/format";
import { recipeHref } from "@/lib/recipes/links";
import type { Recipe, RecipeStats } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";

const MAX_BADGES = 2;

export interface RecipeCardProps {
  recipe: Recipe;
  stats?: RecipeStats;
}

/** A vault list row. The whole card opens the recipe; the star (outside the link) toggles the favorite. */
export function RecipeCard({ recipe, stats }: RecipeCardProps) {
  const badges = recipe.categories.slice(0, MAX_BADGES);
  const hidden = recipe.categories.length - badges.length;
  return (
    <li className="relative">
      <Link href={recipeHref(recipe.id)} className="block rounded-2xl">
        <Card className={cn("flex items-start gap-3.5 p-3", cardInteractive)}>
          <RecipeThumb photoId={stats?.coverPhotoId ?? null} />
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 pr-8 font-serif text-[17px] font-semibold leading-snug text-ink">{recipe.title}</h2>
            <RecipeMeta recipe={recipe} />
            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {badges.map((category) => (
                  <Badge key={category}>{category}</Badge>
                ))}
                {hidden > 0 && (
                  <Badge>
                    +{hidden}
                    <span className="sr-only"> more</span>
                  </Badge>
                )}
              </div>
            )}
            {stats && stats.count > 0 && (
              <p className="mt-2 text-xs text-muted">
                Cooked {stats.count}×{stats.lastDate && ` · ${formatAgo(stats.lastDate)}`}
              </p>
            )}
          </div>
        </Card>
      </Link>
      <FavoriteButton recipeId={recipe.id} favorite={recipe.favorite} className="absolute right-1 top-1" />
    </li>
  );
}

function RecipeThumb({ photoId }: { photoId: string | null }) {
  const url = usePhotoUrl(photoId, "thumb");
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB; next/image can't optimise it
    return <img src={url} alt="" className="size-[68px] shrink-0 rounded-xl bg-surface-2 object-cover" />;
  }
  return (
    <div
      aria-hidden
      className="flex size-[68px] shrink-0 items-center justify-center rounded-xl bg-accent-soft text-on-accent-soft"
    >
      <ChefHat className="size-7" strokeWidth={1.6} />
    </div>
  );
}

function RecipeMeta({ recipe }: { recipe: Recipe }) {
  const time = formatMinutes(totalMinutes(recipe.prepMinutes, recipe.cookMinutes));
  const { calories, protein } = recipe.macros;
  if (!time && recipe.servings == null && calories == null && protein == null) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
      {time && <MetaItem icon={<Clock />} label="Total time" text={time} />}
      {recipe.servings != null && <MetaItem icon={<Users />} label="Serves" text={formatNumber(recipe.servings)} />}
      {calories != null && <MetaItem icon={<Flame />} text={`${formatNumber(calories, 0)} kcal`} />}
      {protein != null && <MetaItem icon={<Dumbbell />} text={`${formatNumber(protein)} g protein`} />}
    </p>
  );
}

function MetaItem({ icon, label, text }: { icon: ReactNode; label?: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0">
      <span aria-hidden className="contents">
        {icon}
      </span>
      {label && <span className="sr-only">{label} </span>}
      {text}
    </span>
  );
}
