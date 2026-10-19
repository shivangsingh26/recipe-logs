import { Check, ClipboardPaste, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const FORMATS = [
  "Answers from ChatGPT or Claude, emoji headings and all",
  "Text copied from recipe websites",
  "Quick notes — a title, a few ingredients, a few steps",
  "Prep/cook times, servings, tags and macros, even tables",
  "Sub-groups like “For the marinade”",
];

/** Shown while the box is empty: what can be pasted, and a one-tap example. */
export function ImportGuide({ onExample }: { onExample: () => void }) {
  return (
    <Card className="flex flex-col items-center px-5 py-8 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-on-accent-soft [&_svg]:size-7">
        <ClipboardPaste aria-hidden />
      </div>
      <h2 className="font-serif text-xl font-semibold text-ink">Paste any recipe</h2>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted">
        A live preview appears here. Check it, then save it to your vault or fine-tune it first.
      </p>
      <ul className="mt-5 flex w-full max-w-sm flex-col gap-2.5 text-left text-[15px] text-ink">
        {FORMATS.map((format) => (
          <li key={format} className="flex gap-2.5">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            <span>{format}</span>
          </li>
        ))}
      </ul>
      <Button variant="soft" icon={<Sparkles />} onClick={onExample} className="mt-6">
        Try the example
      </Button>
    </Card>
  );
}
