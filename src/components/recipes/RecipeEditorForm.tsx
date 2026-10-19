"use client";

import { Check, Timer, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { Field, NumberInput, TextArea, TextInput } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { suggestCategories } from "@/lib/categories";
import { createRecipe, updateRecipe } from "@/lib/db";
import { clearDraft } from "@/lib/drafts";
import { useBack } from "@/lib/navigation";
import { draftFromEditorState, editorStateFromDraft, type EditorState } from "@/lib/recipes/editorRows";
import { recipeHref } from "@/lib/recipes/links";
import type { RecipeDraft } from "@/lib/types";
import { CategoryPicker } from "./CategoryPicker";
import { EditorSection } from "./EditorSection";
import { MacrosFields } from "./MacrosFields";
import { RowListEditor } from "./RowListEditor";
import { useDeleteRecipe } from "./useDeleteRecipe";
import { useDocumentTitle } from "./useDocumentTitle";

export type EditorMode = "create" | "edit" | "import";

const TITLES: Record<EditorMode, string> = { create: "New recipe", edit: "Edit recipe", import: "Review import" };

export interface RecipeEditorFormProps {
  mode: EditorMode;
  /** Read once, when the form mounts. */
  initialDraft: RecipeDraft;
  /** The recipe being edited (edit mode). */
  recipeId?: string;
  /** Parser warnings shown above the form when reviewing an import. */
  warnings?: readonly string[];
  /** Called right before the recipe is deleted (edit mode). */
  onDeleting?: () => void;
}

/** The full-screen recipe form with its sticky Cancel / Save bar and unsaved-changes guard. */
export function RecipeEditorForm({ mode, initialDraft, recipeId, warnings = [], onDeleting }: RecipeEditorFormProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const deleteWithUndo = useDeleteRecipe();
  const titleId = useId();
  const descriptionId = useId();
  const timeId = useId();

  const [initial] = useState(() => editorStateFromDraft(initialDraft));
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  const baseline = useMemo(() => JSON.stringify(draftFromEditorState(initial)), [initial]);
  const draft = draftFromEditorState(state);
  // An import isn't stored anywhere yet, so leaving it always loses work.
  const dirty = mode === "import" || JSON.stringify(draft) !== baseline;
  const canSave = state.title.trim() !== "";
  const back = useBack(mode === "edit" && recipeId ? recipeHref(recipeId) : mode === "import" ? "/import/" : "/");

  useDocumentTitle(TITLES[mode]);
  useBeforeUnloadGuard(dirty && !saving);

  const patch = (changes: Partial<EditorState>) => setState((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      let id = recipeId;
      if (mode === "edit" && recipeId) {
        if (dirty) await updateRecipe(recipeId, draft);
      } else {
        id = (await createRecipe(draft)).id;
        if (mode === "import") clearDraft();
      }
      toast.show({ title: "Recipe saved", tone: "success" });
      if (id) router.replace(recipeHref(id));
    } catch {
      setSaving(false);
      toast.show({ title: "Couldn’t save the recipe", description: "Please try again.", tone: "danger" });
    }
  };

  const cancel = async () => {
    if (dirty) {
      const discard = await confirm({
        title: "Discard changes?",
        body: mode === "import" ? "This imported recipe hasn’t been saved yet." : "Your unsaved edits will be lost.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "danger",
      });
      if (!discard) return;
    }
    if (mode === "import") clearDraft();
    back();
  };

  // PageHeader's back button navigates by itself; route it through cancel() so edits are guarded.
  const guardHeaderBack = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof Element) || !e.target.closest("header button[aria-label='Back']")) return;
    e.preventDefault();
    e.stopPropagation();
    void cancel();
  };

  return (
    <div className="flex flex-1 flex-col" onClickCapture={guardHeaderBack}>
      <PageHeader size="compact" backHref="/" title={TITLES[mode]} />
      <main className="space-y-6 px-4 pb-nav pt-4">
        {warnings.length > 0 && <ImportWarnings warnings={warnings} />}

        <EditorSection title="Basics">
          <Field label="Title" htmlFor={titleId}>
            <TextInput
              id={titleId}
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Black pepper chicken roast"
              maxLength={200}
              aria-required="true"
            />
          </Field>
          <Field label="Description" htmlFor={descriptionId} optional>
            <TextArea
              id={descriptionId}
              rows={2}
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="A line or two about the dish"
              maxLength={2000}
            />
          </Field>
        </EditorSection>

        <EditorSection title="Categories">
          <CategoryPicker
            value={state.categories}
            onChange={(categories) => patch({ categories })}
            suggestions={suggestCategories(draft)}
          />
        </EditorSection>

        <EditorSection title="Time & servings">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Prep" htmlFor={`${timeId}-prep`}>
              <NumberInput
                id={`${timeId}-prep`}
                value={state.prepMinutes}
                onValueChange={(prepMinutes) => patch({ prepMinutes })}
                suffix="min"
              />
            </Field>
            <Field label="Cook" htmlFor={`${timeId}-cook`}>
              <NumberInput
                id={`${timeId}-cook`}
                value={state.cookMinutes}
                onValueChange={(cookMinutes) => patch({ cookMinutes })}
                suffix="min"
              />
            </Field>
            <Field label="Servings" htmlFor={`${timeId}-servings`}>
              <NumberInput
                id={`${timeId}-servings`}
                value={state.servings}
                onValueChange={(servings) => patch({ servings })}
              />
            </Field>
          </div>
        </EditorSection>

        <EditorSection title="Macros per serving">
          <MacrosFields value={state.macros} onChange={(macros) => patch({ macros })} />
        </EditorSection>

        <EditorSection title="Ingredients">
          <RowListEditor
            variant="ingredients"
            rows={state.ingredientRows}
            onChange={(ingredientRows) => patch({ ingredientRows })}
          />
          <p className="text-xs leading-relaxed text-muted">
            Paste a list to add several at once. Lines ending in “:” become sections.
          </p>
        </EditorSection>

        <EditorSection title="Steps">
          <RowListEditor variant="steps" rows={state.stepRows} onChange={(stepRows) => patch({ stepRows })} />
          <p className="flex items-center gap-1.5 text-xs leading-relaxed text-muted">
            <Timer aria-hidden className="size-3.5 shrink-0" />
            Durations like “14 min” become tap-to-start timers.
          </p>
        </EditorSection>

        <EditorSection title="Notes & tips">
          <TextArea
            aria-label="Notes and tips"
            value={state.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Swaps, timings that worked, what to try next time"
          />
          <p className="text-xs leading-relaxed text-muted">Start a line with “- ” for a bullet. **Bold** works too.</p>
        </EditorSection>

        <EditorSection title="Source">
          <TextInput
            aria-label="Source"
            value={state.source}
            onChange={(e) => patch({ source: e.target.value })}
            placeholder="A link, a book, or who taught you"
            maxLength={2000}
            autoCapitalize="off"
          />
        </EditorSection>

        {mode === "edit" && recipeId && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void deleteWithUndo({ id: recipeId, title: state.title.trim() || initial.title }, onDeleting)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-medium text-danger shadow-card transition-colors active:bg-surface-2 disabled:opacity-50"
          >
            <Trash2 aria-hidden className="size-[18px]" />
            Delete recipe
          </button>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-[var(--dock-h)] z-30 border-t border-line bg-surface/90 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={() => void cancel()}>
            Cancel
          </Button>
          <Button fullWidth loading={saving} disabled={!canSave} icon={<Check aria-hidden />} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportWarnings({ warnings }: { warnings: readonly string[] }) {
  return (
    <div role="note" className="flex gap-3 rounded-2xl border border-warning/25 bg-warning-soft p-4">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="font-semibold text-warning">Check the import</p>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink">
          {warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Asks the browser to confirm closing or reloading the tab while there are unsaved edits. */
function useBeforeUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older Safari/Chrome only prompt when returnValue is set.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}
