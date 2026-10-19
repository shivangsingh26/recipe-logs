import Link from "next/link";
import type { ReactNode } from "react";
import { editRecipeHref } from "@/lib/recipes/links";

/** Quiet empty message for a recipe tab, pointing at the editor. */
export function PanelEmpty({ recipeId, children }: { recipeId: string; children: ReactNode }) {
  return (
    <p className="px-2 py-10 text-center text-[15px] leading-relaxed text-muted">
      {children}{" "}
      <Link href={editRecipeHref(recipeId)} className="font-medium text-accent underline-offset-2 hover:underline">
        Edit recipe
      </Link>
    </p>
  );
}
