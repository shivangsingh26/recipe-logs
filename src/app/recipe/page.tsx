// Recipe detail lives at /recipe/?id=<id>: a static export cannot pre-build one page per id,
// so the screen reads the id from the query string (inside Suspense, as useSearchParams requires).

import { Suspense } from "react";
import { RecipeDetailScreen } from "@/components/recipes/RecipeDetailScreen";
import { RecipeDetailSkeleton } from "@/components/recipes/RecipeDetailSkeleton";

export default function RecipePage() {
  return (
    <Suspense fallback={<RecipeDetailSkeleton />}>
      <RecipeDetailScreen />
    </Suspense>
  );
}
