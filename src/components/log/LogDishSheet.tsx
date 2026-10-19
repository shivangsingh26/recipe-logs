"use client";

import { Trash2 } from "lucide-react";
import { useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, inputClasses, TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, Spinner } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import type { CookLog } from "@/lib/types";
import { DishPicker } from "./DishPicker";
import { MealPicker } from "./MealPicker";
import { PhotoField } from "./PhotoField";
import { useLogDishForm } from "./useLogDishForm";

export interface LogDishSheetProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select a vault recipe (e.g. "Log this dish" on a recipe page). */
  initialRecipeId?: string | null;
  /** Pre-fill the date ("YYYY-MM-DD"), e.g. the day selected in the calendar. Defaults to today. */
  initialDate?: string;
  /** Edit this existing entry instead of creating a new one. */
  editLogId?: string | null;
  /** Called after a successful save, before the sheet asks the parent to close it (onClose). */
  onSaved?: (log: CookLog) => void;
}

/**
 * Log a cooked dish (or edit/delete an entry). Shows its own toasts; the parent only owns `open`.
 * Every opening starts from a fresh form, so several quick logs in a row work.
 */
export function LogDishSheet(props: LogDishSheetProps) {
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession((n) => n + 1);
  }
  return <LogDishDialog key={session} {...props} />;
}

function LogDishDialog({ open, onClose, initialRecipeId, initialDate, editLogId, onSaved }: LogDishSheetProps) {
  const dishInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const form = useLogDishForm(
    { initialRecipeId, initialDate, editLogId, onSaved, onClose },
    { dishInput: dishInputRef, dateInput: dateInputRef, save: saveRef },
  );
  const mealLabelId = useId();
  const photoLabelId = useId();
  const notesId = useId();
  const dateId = useId();
  const busy = form.status !== "idle";

  const footer = form.missing ? (
    <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
      Close
    </Button>
  ) : (
    // A grid, not flex: full-width Buttons are shrink-0 and would overflow a flex row.
    <div className={cn("grid gap-3", form.isEdit ? "grid-cols-[3rem_1fr_1fr]" : "grid-cols-2")}>
      {form.isEdit && (
        <button
          type="button"
          aria-label="Delete entry"
          title="Delete entry"
          onClick={form.remove}
          disabled={busy || form.loading}
          aria-busy={form.status === "deleting" || undefined}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger transition-[transform,opacity] duration-150 active:scale-95 disabled:opacity-50 [&_svg]:size-5"
        >
          {form.status === "deleting" ? <Spinner /> : <Trash2 />}
        </button>
      )}
      <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
        Cancel
      </Button>
      <Button
        ref={saveRef}
        size="lg"
        fullWidth
        loading={form.status === "saving"}
        disabled={form.loading || form.photoBusy || form.status === "deleting"}
        onClick={form.save}
      >
        Save
      </Button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={form.isEdit ? "Edit entry" : "Log a dish"} footer={footer}>
      {form.loading ? (
        <div className="space-y-6 pt-1" aria-hidden>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-12" />
        </div>
      ) : form.missing ? (
        <p className="py-4 text-[15px] text-muted">This entry no longer exists.</p>
      ) : (
        <div className="space-y-6 pb-2 pt-1">
          <DishPicker
            value={form.dish}
            onChange={form.chooseDish}
            query={form.query}
            onQueryChange={form.changeQuery}
            recipes={form.recipes}
            error={form.dishError}
            inputRef={dishInputRef}
          />
          <div>
            <p id={mealLabelId} className="mb-1.5 px-0.5 text-sm font-medium text-ink">
              Meal
            </p>
            <MealPicker value={form.meal} onChange={form.chooseMeal} labelledBy={mealLabelId} />
          </div>
          <DateField
            id={dateId}
            value={form.date}
            today={form.today}
            error={form.dateError}
            onChange={form.chooseDate}
            inputRef={dateInputRef}
          />
          <Field label="Notes / tweaks" htmlFor={notesId} optional>
            <TextArea
              id={notesId}
              value={form.notes}
              onChange={(e) => form.setNotes(e.target.value)}
              placeholder="e.g. Air fried birista for 14 mins, extra pepper"
            />
          </Field>
          <div>
            <p id={photoLabelId} className="mb-1.5 px-0.5 text-sm font-medium text-ink">
              Plate photo<span className="ml-1 font-normal text-muted">(optional)</span>
            </p>
            <PhotoField
              existingPhotoId={form.existingPhotoId}
              value={form.photo}
              onChange={form.choosePhoto}
              busy={form.photoBusy}
              onBusyChange={form.setPhotoBusy}
              labelledBy={photoLabelId}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}

interface DateFieldProps {
  id: string;
  value: string;
  today: string;
  error: string | null;
  onChange: (date: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

function DateField({ id, value, today, error, onChange, inputRef }: DateFieldProps) {
  const errorId = `${id}-error`;
  const shortcuts = [
    { label: "Today", date: today },
    { label: "Yesterday", date: addDays(today, -1) },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="px-0.5 text-sm font-medium text-ink">
          Date
        </label>
        <div className="flex gap-2">
          {shortcuts.map((s) => (
            <Chip
              key={s.label}
              selected={value === s.date}
              onClick={() => onChange(s.date)}
              className="relative after:absolute after:-inset-y-1 after:inset-x-0"
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>
      <input
        id={id}
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(inputClasses, "h-12 appearance-none text-left [&::-webkit-date-and-time-value]:text-left")}
      />
      {error && (
        <p id={errorId} className="px-0.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
