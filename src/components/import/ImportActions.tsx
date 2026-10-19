"use client";

import { BookmarkPlus, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ImportActionsProps {
  usable: boolean;
  saving: boolean;
  onReview: () => void;
  onSave: () => void;
}

/** "Review & edit" opens the editor with the parsed draft; "Save to vault" saves it as is. */
export function ImportActions({ usable, saving, onReview, onSave }: ImportActionsProps) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<PencilLine />} disabled={!usable || saving} onClick={onReview} className="px-3">
          Review &amp; edit
        </Button>
        <Button icon={<BookmarkPlus />} disabled={!usable} loading={saving} onClick={onSave} className="px-3">
          Save to vault
        </Button>
      </div>
      {!usable && (
        <p className="text-center text-xs text-muted">Add at least one ingredient or step to save this recipe.</p>
      )}
    </div>
  );
}
