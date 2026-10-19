"use client";

// How to build the "Save to CulinaryLog" Shortcut, with the two values it needs ready to copy.

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/lib/recipes/clipboard";

export interface ShortcutSetupSheetProps {
  open: boolean;
  onClose: () => void;
  relayUrl: string;
  token: string;
}

function CopyField({ label, value, display }: { label: string; value: string; display?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      toast.show({ title: `${label} copied`, tone: "success" });
    } else {
      toast.show({ title: "Couldn't copy", tone: "danger" });
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 py-2 pl-3.5 pr-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="break-all font-mono text-sm text-ink">{display ?? value}</p>
      </div>
      <Button variant="secondary" size="sm" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-muted"
      >
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[13px]">{children}</code>;
}

export function ShortcutSetupSheet({ open, onClose, relayUrl, token }: ShortcutSetupSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Set up the Shortcut" description="Once, in the Shortcuts app. About two minutes.">
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col gap-2">
          <CopyField label="Address" value={`${relayUrl}/api/inbox`} />
          <CopyField label="Authorization" value={`Bearer ${token}`} display={`Bearer ••••••${token.slice(-4)}`} />
        </div>
        <ol className="space-y-3 text-[15px] leading-snug text-ink">
          <Step n={1}>
            In <strong>Shortcuts</strong>, tap <strong>+</strong> and name it “Save to CulinaryLog”.
          </Step>
          <Step n={2}>
            Add <strong>Get Clipboard</strong>.
          </Step>
          <Step n={3}>
            Add <strong>If</strong>: <em>Clipboard</em> <strong>contains</strong> <Code>Ingredients</Code>.
          </Step>
          <Step n={4}>
            Inside it, add <strong>Get Contents of URL</strong> with the Address. Under <strong>Show More</strong>: Method{" "}
            <strong>POST</strong>; a header <Code>Authorization</Code> with the value above; Request Body{" "}
            <strong>JSON</strong> with a Text field <Code>text</Code> set to <em>Clipboard</em>.
          </Step>
          <Step n={5}>
            Below it, add <strong>If</strong> <em>Contents of URL</em> <strong>has any value</strong>, and inside that{" "}
            <strong>Show Notification</strong> with <em>Contents of URL</em>.
          </Step>
          <Step n={6}>
            Run it with <strong>Settings → Accessibility → Touch → Back Tap → Double Tap</strong>. Or make it automatic:{" "}
            <strong>Shortcuts → Automation → + → App → Gemini → Is Closed → Run Immediately</strong>.
          </Step>
        </ol>
        <p className="text-sm leading-relaxed text-muted">
          Then in Gemini: say “save it”, tap the copy icon, and double-tap the back of your phone (or just leave Gemini).
          The recipe is waiting here the next time you open CulinaryLog. Sending the same recipe twice does nothing.
        </p>
      </div>
    </Sheet>
  );
}
