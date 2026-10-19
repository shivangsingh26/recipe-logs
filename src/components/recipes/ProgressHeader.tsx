import { RotateCcw } from "lucide-react";

export interface ProgressHeaderProps {
  summary: string;
  /** Shown as a "Reset" text button when given (i.e. when something is ticked). */
  onReset?: () => void;
}

/** "17 ingredients · serves 4" … "Reset", above a cooking checklist. */
export function ProgressHeader({ summary, onReset }: ProgressHeaderProps) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <p className="text-sm text-muted">{summary}</p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset cooking progress"
          className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-accent transition-opacity active:opacity-60"
        >
          <RotateCcw aria-hidden className="size-4" />
          Reset
        </button>
      )}
    </div>
  );
}
