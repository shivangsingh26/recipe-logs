"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConnection } from "@/lib/inbox/connection";
import { ASSISTANT_NAME, assistantInstructions } from "@/lib/markdown/assistantPrompt";
import { copyText } from "@/lib/recipes/clipboard";

/** One-time setup for brainstorming in Gemini (or ChatGPT/Claude) and saving the result here. */
export function AssistantSetup() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const connected = useConnection() !== null;

  const copy = async () => {
    if (await copyText(assistantInstructions())) {
      setCopied(true);
      toast.show({
        title: "Instructions copied",
        description: `Paste them into a new Gem called “${ASSISTANT_NAME}”.`,
        tone: "success",
      });
    } else {
      toast.show({ title: "Couldn't copy the instructions", tone: "danger" });
    }
  };

  return (
    <Card className="px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-on-accent-soft [&_svg]:size-5">
          <Sparkles aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold leading-snug text-ink">Brainstorm in Gemini, save here</h2>
          <p className="mt-0.5 text-sm text-muted">Set it up once. After that, a finished recipe takes two taps to save.</p>
        </div>
      </div>
      <ol className="mt-4 space-y-3 text-[15px] leading-snug text-ink">
        <Step n={1}>
          In Gemini, open <strong>Gems → New Gem</strong>, name it “{ASSISTANT_NAME}” and paste the instructions below.
        </Step>
        <Step n={2}>
          Brainstorm in that Gem. When the recipe is right, say <strong>“save it”</strong>.
        </Step>
        <Step n={3}>
          {connected ? (
            <>
              Tap the copy icon on the recipe it sends. Your Shortcut brings it here (or come back and tap{" "}
              <strong>Paste &amp; save</strong>).
            </>
          ) : (
            <>
              Tap the copy icon on the recipe it sends, come back here and tap <strong>Paste &amp; save</strong>.
            </>
          )}
        </Step>
      </ol>
      {!connected && (
        <p className="mt-3 text-sm text-muted">
          On iPhone, a Shortcut can skip the trip back here.{" "}
          <Link href="/settings/#gemini" className="font-medium text-accent-hover underline-offset-2 hover:underline dark:text-accent">
            Set it up in Settings
          </Link>
        </p>
      )}
      <Button variant="secondary" fullWidth icon={copied ? <Check /> : <Copy />} onClick={() => void copy()} className="mt-4">
        {copied ? "Copied" : "Copy Gem instructions"}
      </Button>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Saving a recipe with the same title again offers to update it. The same instructions work for a ChatGPT custom
        GPT or a Claude project.
      </p>
    </Card>
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
