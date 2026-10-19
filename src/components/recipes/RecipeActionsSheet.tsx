"use client";

import { Copy, CopyPlus, Share2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { duplicateRecipe } from "@/lib/db";
import { recipeToMarkdown } from "@/lib/markdown/recipeMarkdown";
import { copyText } from "@/lib/recipes/clipboard";
import { recipeHref } from "@/lib/recipes/links";
import type { Recipe } from "@/lib/types";
import { useDeleteRecipe } from "./useDeleteRecipe";

export interface RecipeActionsSheetProps {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  /** Called right before the recipe is deleted. */
  onDeleting: () => void;
}

/** The recipe page's "More" sheet: share / copy as Markdown, duplicate, delete. */
export function RecipeActionsSheet({ open, onClose, recipe, onDeleting }: RecipeActionsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Recipe options">
      <ActionList recipe={recipe} onClose={onClose} onDeleting={onDeleting} />
    </Sheet>
  );
}

// Mounted only while the sheet is open, so browser capability checks run on the client.
function ActionList({ recipe, onClose, onDeleting }: Omit<RecipeActionsSheetProps, "open">) {
  const router = useRouter();
  const toast = useToast();
  const deleteWithUndo = useDeleteRecipe();
  const canShare = typeof navigator.share === "function";

  const copyMarkdown = async (markdown: string) => {
    const copied = await copyText(markdown);
    toast.show(
      copied
        ? { title: "Copied as Markdown", tone: "success" }
        : { title: "Couldn’t copy", description: "Clipboard access was blocked.", tone: "danger" },
    );
  };

  const share = async () => {
    const text = recipeToMarkdown(recipe);
    onClose();
    try {
      // No await before this call: share() needs the tap's user activation.
      await navigator.share({ title: recipe.title, text });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // closed the share sheet
      await copyMarkdown(text);
    }
  };

  const copy = () => {
    const text = recipeToMarkdown(recipe);
    onClose();
    void copyMarkdown(text);
  };

  const duplicate = async () => {
    onClose();
    try {
      const created = await duplicateRecipe(recipe.id);
      toast.show({ title: "Recipe duplicated", tone: "success" });
      router.push(recipeHref(created.id));
    } catch {
      toast.show({ title: "Couldn’t duplicate the recipe", tone: "danger" });
    }
  };

  const remove = () => {
    onClose();
    void deleteWithUndo(recipe, onDeleting);
  };

  return (
    <ul className="-mx-2 pb-1">
      {canShare && (
        <ActionRow icon={<Share2 aria-hidden />} onClick={() => void share()}>
          Share…
        </ActionRow>
      )}
      <ActionRow icon={<Copy aria-hidden />} onClick={copy}>
        Copy as Markdown
      </ActionRow>
      <ActionRow icon={<CopyPlus aria-hidden />} onClick={() => void duplicate()}>
        Duplicate
      </ActionRow>
      <li aria-hidden className="mx-3 my-1 h-px bg-line" />
      <ActionRow icon={<Trash2 aria-hidden />} tone="danger" onClick={remove}>
        Delete recipe
      </ActionRow>
    </ul>
  );
}

function ActionRow({
  icon,
  tone,
  onClick,
  children,
}: {
  icon: ReactNode;
  tone?: "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium transition-colors",
          "hover:bg-surface-2 active:bg-surface-3 [&_svg]:size-5 [&_svg]:shrink-0",
          tone === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {icon}
        {children}
      </button>
    </li>
  );
}
