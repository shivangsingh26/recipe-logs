// /recipe/edit/ = new recipe, /recipe/edit/?id=<id> = edit, /recipe/edit/?from=import = review an imported draft.

import { Suspense } from "react";
import { RecipeEditorScreen } from "@/components/recipes/RecipeEditorScreen";
import { RecipeEditorSkeleton } from "@/components/recipes/RecipeEditorSkeleton";

export default function EditRecipePage() {
  return (
    <Suspense fallback={<RecipeEditorSkeleton />}>
      <RecipeEditorScreen />
    </Suspense>
  );
}
