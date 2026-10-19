"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { deleteRecipe, undoDeleteRecipe } from "@/lib/db";

export type DeleteRecipeFn = (recipe: { id: string; title: string }, onDeleting?: () => void) => Promise<boolean>;

/**
 * Confirm → delete → back to the vault → "Recipe deleted" toast with Undo.
 * `onDeleting` runs just before the delete so the caller can stop rendering the recipe.
 * Resolves true when the recipe was deleted.
 */
export function useDeleteRecipe(): DeleteRecipeFn {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  return useCallback<DeleteRecipeFn>(
    async (recipe, onDeleting) => {
      const ok = await confirm({
        title: "Delete this recipe?",
        body: `“${recipe.title}” will be removed from your vault. Its cook log entries are kept.`,
        confirmLabel: "Delete",
        tone: "danger",
      });
      if (!ok) return false;
      onDeleting?.();
      try {
        const snapshot = await deleteRecipe(recipe.id);
        router.replace("/");
        if (snapshot) {
          toast.show({
            title: "Recipe deleted",
            description: recipe.title,
            action: {
              label: "Undo",
              onClick: () => {
                undoDeleteRecipe(snapshot).then(
                  () => toast.show({ title: "Recipe restored", tone: "success" }),
                  () => toast.show({ title: "Couldn’t restore the recipe", tone: "danger" }),
                );
              },
            },
          });
        }
        return true;
      } catch {
        toast.show({ title: "Couldn’t delete the recipe", description: "Please try again.", tone: "danger" });
        return false;
      }
    },
    [confirm, toast, router],
  );
}
