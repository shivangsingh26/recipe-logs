"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useRecipe } from "@/lib/db";
import { RecipeDetail } from "./RecipeDetail";
import { RecipeDetailSkeleton } from "./RecipeDetailSkeleton";
import { RecipeNotFound } from "./RecipeNotFound";

/** /recipe/?id=… : loads the recipe named in the query string. */
export function RecipeDetailScreen() {
  const id = useSearchParams()?.get("id") ?? null;
  const recipe = useRecipe(id);
  // Set right before a delete, so the page doesn't flash "not found" while it navigates away.
  const [leaving, setLeaving] = useState(false);

  if (recipe === undefined || (recipe === null && leaving)) return <RecipeDetailSkeleton />;
  if (recipe === null) return <RecipeNotFound />;
  return <RecipeDetail key={recipe.id} recipe={recipe} onDeleting={() => setLeaving(true)} />;
}
