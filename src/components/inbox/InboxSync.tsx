"use client";

// Collects recipes sent from Gemini (via the relay) whenever the app opens, comes back to the
// foreground or gets its connection back, and shows one toast per recipe with Undo.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { setImportText } from "@/components/import/useImportText";
import { useToast } from "@/components/ui/Toast";
import { useConnection } from "@/lib/inbox/connection";
import { inboxRunner } from "@/lib/inbox/runner";
import { undoInboxOutcome, type InboxOutcome } from "@/lib/inbox/sync";

/** More arrivals than this become one summary toast (the toast stack shows three). */
const MAX_TOASTS = 3;
const UNDO_MS = 8000;

export function InboxSync() {
  const toast = useToast();
  const router = useRouter();
  const connected = useConnection() !== null;

  useEffect(() => {
    const undo = async (outcome: InboxOutcome) => {
      try {
        await undoInboxOutcome(outcome);
        toast.show({ title: outcome.kind === "updated" ? "Previous version restored" : "Recipe removed" });
      } catch {
        toast.show({ title: "Couldn't undo", tone: "danger" });
      }
    };

    const show = (outcome: InboxOutcome) => {
      if (outcome.kind === "unreadable") {
        toast.show({
          id: `inbox-${outcome.itemId}`,
          title: "Couldn't read a recipe from Gemini",
          description: "Open it in Import to fix it.",
          tone: "danger",
          duration: UNDO_MS,
          action: {
            label: "Open",
            onClick: () => {
              setImportText(outcome.text);
              router.push("/import/");
            },
          },
        });
        return;
      }
      toast.show({
        id: `inbox-${outcome.itemId}`,
        title: outcome.kind === "updated" ? "Updated from Gemini" : "Saved from Gemini",
        description: outcome.warning ? `${outcome.recipe.title} · ${outcome.warning}` : outcome.recipe.title,
        tone: "success",
        duration: UNDO_MS,
        action: { label: "Undo", onClick: () => void undo(outcome) },
      });
    };

    return inboxRunner.onOutcomes((outcomes) => {
      if (outcomes.length <= MAX_TOASTS) {
        outcomes.forEach(show);
        return;
      }
      const saved = outcomes.filter((o) => o.kind !== "unreadable").length;
      toast.show({
        id: "inbox-summary",
        title: `${saved} recipes arrived from Gemini`,
        description: saved < outcomes.length ? `${outcomes.length - saved} couldn't be read.` : undefined,
        tone: "success",
      });
    });
  }, [router, toast]);

  useEffect(() => {
    if (!connected) return;
    const run = () => {
      if (document.visibilityState === "visible") void inboxRunner.run();
    };
    run();
    document.addEventListener("visibilitychange", run);
    window.addEventListener("online", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("online", run);
    };
  }, [connected]);

  return null;
}
