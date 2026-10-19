"use client";

// Quick-Import: paste (or open, or try the example), see a live parsed preview, then save
// straight to the vault or hand the draft to the editor for review.

import { ClipboardCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useDeferredValue, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextArea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { stashDraft } from "@/lib/drafts";
import { pluralize } from "@/lib/format";
import { EXAMPLE_RECIPE_TEXT } from "@/lib/parser/example";
import { parseRecipeText } from "@/lib/parser/parseRecipe";
import { AssistantSetup } from "./AssistantSetup";
import { ImportActions } from "./ImportActions";
import { ImportGuide } from "./ImportGuide";
import { ImportPrefill } from "./ImportPrefill";
import { ImportPreview } from "./ImportPreview";
import { ImportToolbar } from "./ImportToolbar";
import { setImportText, useImportText } from "./useImportText";
import { useSaveImported } from "./useSaveImported";

const PLACEHOLDER = [
  "# Pepper Chicken",
  "Serves 3 · Prep 15 min · Cook 35 min",
  "",
  "## Ingredients",
  "- 500 g chicken thighs",
  "- 1½ tbsp black peppercorns",
  "",
  "## Method",
  "1. Marinate for 30 min.",
  "2. Roast for 10 min until dark.",
].join("\n");

/** What normalizeRecipeDraft calls a recipe without a title. */
const UNTITLED = "Untitled recipe";

export function ImportScreen() {
  const router = useRouter();
  const toast = useToast();
  const storedText = useImportText();
  // Freezes the screen while navigating away after a save (the stored text is already cleared).
  const [savedText, setSavedText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const saveImported = useSaveImported();

  const text = savedText ?? storedText;
  const deferredText = useDeferredValue(text);
  const result = useMemo(() => parseRecipeText(deferredText), [deferredText]);
  const hasText = text.trim().length > 0;
  const { ingredients, steps } = result.draft;
  const usable = deferredText.trim().length > 0 && ingredients.length + steps.length > 0;

  const replaceText = (next: string) => {
    const previous = storedText;
    setImportText(next);
    if (previous.trim() && previous !== next) {
      toast.show({
        id: "import-replaced",
        title: "Replaced your text",
        action: {
          label: "Undo",
          onClick: () => {
            setImportText(previous);
            textarea.current?.focus();
          },
        },
      });
    }
  };

  const clear = () => {
    const previous = storedText;
    setImportText("");
    textarea.current?.focus();
    toast.show({
      id: "import-cleared",
      title: "Cleared",
      action: {
        label: "Undo",
        onClick: () => {
          setImportText(previous);
          textarea.current?.focus();
        },
      },
    });
  };

  const review = () => {
    if (!usable) return;
    stashDraft(result.draft, result.warnings);
    router.push("/recipe/edit/?from=import");
  };

  const save = async () => {
    if (!usable || saving) return;
    setSaving(true);
    try {
      await saveImported(result.draft);
      setSavedText(text);
      setImportText("");
    } catch {
      setSaving(false);
      toast.show({ title: "Couldn't save the recipe", description: "Please try again.", tone: "danger" });
    }
  };

  // One tap for a recipe copied from Gemini/ChatGPT: save it if it's complete, else show it for review.
  const pasteAndSave = async () => {
    if (saving) return;
    let clip: string;
    try {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard API unavailable");
      clip = await navigator.clipboard.readText();
    } catch {
      toast.show({ title: "Long-press the box and choose Paste" });
      textarea.current?.focus();
      return;
    }
    if (!clip.trim()) {
      toast.show({ title: "The clipboard is empty", description: "Copy the recipe in Gemini first." });
      return;
    }
    const parsed = parseRecipeText(clip);
    const { title, ingredients, steps } = parsed.draft;
    if (title === UNTITLED || ingredients.length === 0 || steps.length === 0) {
      replaceText(clip);
      toast.show({ title: "Check this one before saving", description: parsed.warnings[0] });
      return;
    }
    setSaving(true);
    try {
      await saveImported(parsed.draft);
      setImportText("");
    } catch {
      setSaving(false);
      toast.show({ title: "Couldn't save the recipe", description: "Please try again.", tone: "danger" });
    }
  };

  const status = hasText
    ? `Found ${pluralize(ingredients.length, "ingredient")} and ${pluralize(steps.length, "step")}.`
    : "";

  return (
    <>
      <PageHeader title="Import" subtitle="Paste a recipe — Markdown or plain text" />
      <Suspense fallback={null}>
        <ImportPrefill onPrefill={setImportText} />
      </Suspense>
      <main className="flex flex-col gap-5 px-4 pb-nav pt-4">
        <div className="flex flex-col gap-1.5">
          <Button size="lg" fullWidth icon={<ClipboardCheck />} loading={saving} onClick={() => void pasteAndSave()}>
            Paste &amp; save
          </Button>
          <p className="px-1 text-center text-xs text-muted">Copied a recipe from Gemini or ChatGPT? It saves in one tap.</p>
        </div>

        <section aria-label="Recipe text" className="flex flex-col gap-3">
          <ImportToolbar onText={replaceText} onPasteUnavailable={() => textarea.current?.focus()} />
          <div className="relative">
            <label htmlFor="import-text" className="sr-only">
              Recipe text
            </label>
            <TextArea
              id="import-text"
              ref={textarea}
              value={text}
              onChange={(event) => setImportText(event.target.value)}
              readOnly={savedText != null}
              autoGrow={false}
              rows={12}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              autoCapitalize="sentences"
              className="pr-12"
            />
            {hasText && savedText == null && (
              <IconButton label="Clear" onClick={clear} className="absolute right-0.5 top-0.5 text-muted">
                <X />
              </IconButton>
            )}
          </div>
        </section>

        <p role="status" className="sr-only">
          {status}
        </p>

        {hasText ? (
          <ImportPreview
            result={result}
            stale={text !== deferredText}
            actions={<ImportActions usable={usable} saving={saving} onReview={review} onSave={() => void save()} />}
          />
        ) : (
          <>
            <AssistantSetup />
            <ImportGuide onExample={() => replaceText(EXAMPLE_RECIPE_TEXT)} />
          </>
        )}
      </main>
    </>
  );
}
