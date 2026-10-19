"use client";

// Saving an imported recipe. Re-importing a recipe with the same title (e.g. the next round of
// a Gemini brainstorm) offers to update the existing one, which keeps its cook history.

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { createRecipe, findRecipeByTitle, updateRecipe } from "@/lib/db";
import type { Recipe, RecipeDraft } from "@/lib/types";

export function useSaveImported(): (draft: RecipeDraft) => Promise<Recipe> {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  return useCallback(
    async (draft) => {
      const existing = await findRecipeByTitle(draft.title);
      const update =
        existing !== undefined &&
        (await confirm({
          title: `Update “${existing.title}”?`,
          body: "This recipe is already in your vault. Updating replaces its details and keeps its cook history.",
          confirmLabel: "Update",
          cancelLabel: "Save as new",
        }));
      const recipe = update && existing ? await updateRecipe(existing.id, draft) : await createRecipe(draft);
      toast.show({ title: update ? "Recipe updated" : "Saved to your vault", description: recipe.title, tone: "success" });
      router.push(`/recipe/?id=${encodeURIComponent(recipe.id)}`);
      return recipe;
    },
    [confirm, router, toast],
  );
}
