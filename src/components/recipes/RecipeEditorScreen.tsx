"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { draftFromRecipe, emptyRecipeDraft, useRecipe } from "@/lib/db";
import { peekDraft } from "@/lib/drafts";
import { RecipeEditorForm } from "./RecipeEditorForm";
import { RecipeEditorSkeleton } from "./RecipeEditorSkeleton";
import { RecipeNotFound } from "./RecipeNotFound";

/** /recipe/edit/ (new) · ?id=<id> (edit) · ?from=import (review the importer's draft). */
export function RecipeEditorScreen() {
  const params = useSearchParams();
  const id = params?.get("id");
  if (id) return <EditExistingRecipe key={id} id={id} />;
  const fromImport = params?.get("from") === "import";
  return <EditNewRecipe key={fromImport ? "import" : "new"} fromImport={fromImport} />;
}

function EditExistingRecipe({ id }: { id: string }) {
  const recipe = useRecipe(id);
  // Set right before a delete, so the editor doesn't flash "not found" while it navigates away.
  const [leaving, setLeaving] = useState(false);
  if (recipe === undefined || (recipe === null && leaving)) return <RecipeEditorSkeleton />;
  if (recipe === null) return <RecipeNotFound />;
  return (
    <RecipeEditorForm
      mode="edit"
      recipeId={id}
      initialDraft={draftFromRecipe(recipe)}
      onDeleting={() => setLeaving(true)}
    />
  );
}

function EditNewRecipe({ fromImport }: { fromImport: boolean }) {
  // Read once; the stash stays in sessionStorage until the draft is saved or discarded.
  const [stash] = useState(() => (fromImport ? peekDraft() : null));
  const [blank] = useState(() => ({ ...emptyRecipeDraft(), title: "" }));
  if (stash) return <RecipeEditorForm mode="import" initialDraft={stash.draft} warnings={stash.warnings} />;
  return <RecipeEditorForm mode="create" initialDraft={blank} />;
}
