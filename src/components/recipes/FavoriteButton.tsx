"use client";

import { Star } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { setFavorite } from "@/lib/db";

export interface FavoriteButtonProps {
  recipeId: string;
  favorite: boolean;
  className?: string;
}

/** Star toggle. The live recipe query re-renders it with the stored state. */
export function FavoriteButton({ recipeId, favorite, className }: FavoriteButtonProps) {
  const toast = useToast();
  const toggle = () => {
    setFavorite(recipeId, !favorite).catch(() => toast.show({ title: "Couldn’t update favorites", tone: "danger" }));
  };
  return (
    <IconButton label="Favorite" aria-pressed={favorite} onClick={toggle} className={className}>
      <Star aria-hidden className={cn(favorite ? "fill-current text-accent" : "text-muted")} />
    </IconButton>
  );
}
