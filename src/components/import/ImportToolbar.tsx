"use client";

import { ClipboardPaste, FileUp, Sparkles } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EXAMPLE_RECIPE_TEXT } from "@/lib/parser/example";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type TextOrigin = "paste" | "file" | "example";

export interface ImportToolbarProps {
  onText: (text: string, origin: TextOrigin) => void;
  /** Called when the clipboard can't be read, so the box can take focus for a manual paste. */
  onPasteUnavailable: () => void;
}

/** Paste / Open file / Example. */
export function ImportToolbar({ onText, onPasteUnavailable }: ImportToolbarProps) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const paste = async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard API unavailable");
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        toast.show({ title: "The clipboard is empty" });
        return;
      }
      onText(clip, "paste");
    } catch {
      toast.show({ title: "Long-press the box and choose Paste" });
      onPasteUnavailable();
    }
  };

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.show({ title: "That file is too large", description: "Recipes are usually well under 2 MB.", tone: "danger" });
      return;
    }
    try {
      onText(await file.text(), "file");
    } catch {
      toast.show({ title: "Couldn't read that file", tone: "danger" });
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="soft" icon={<ClipboardPaste />} onClick={() => void paste()} className="flex-1 px-3">
        Paste
      </Button>
      <Button variant="secondary" icon={<FileUp />} onClick={() => fileInput.current?.click()} className="flex-1 px-3">
        Open file
      </Button>
      <Button variant="secondary" icon={<Sparkles />} onClick={() => onText(EXAMPLE_RECIPE_TEXT, "example")} className="flex-1 px-3">
        Example
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void openFile(e)}
      />
    </div>
  );
}
