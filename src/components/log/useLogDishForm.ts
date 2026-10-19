import { useState, type RefObject } from "react";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { defaultMealForTime, formatDayLabel, isDateKey, todayKey } from "@/lib/dates";
import { createLog, deleteLog, undoDeleteLog, updateLog, useLog, useRecipe, useRecipes } from "@/lib/db";
import { findExactRecipe } from "@/lib/log/dishSearch";
import { MEAL_LABELS, type CookLog, type CookLogInput, type MealType, type PhotoInput } from "@/lib/types";
import type { DishChoice } from "./DishPicker";
import type { PhotoChange } from "./PhotoField";

export interface LogDishFormOptions {
  initialRecipeId?: string | null;
  initialDate?: string;
  editLogId?: string | null;
  onSaved?: (log: CookLog) => void;
  onClose: () => void;
}

/** Controls that receive focus after a failed validation or save. */
export interface LogDishFormFocusTargets {
  dishInput: RefObject<HTMLInputElement | null>;
  dateInput: RefObject<HTMLInputElement | null>;
  save: RefObject<HTMLButtonElement | null>;
}

function defaultMeal(date: string, today: string): MealType {
  return date === today ? defaultMealForTime() : "dinner";
}

/** State and actions of the Log Dish sheet. Mounted fresh for every opening of the sheet. */
export function useLogDishForm(
  { initialRecipeId, initialDate, editLogId, onSaved, onClose }: LogDishFormOptions,
  focusTargets: LogDishFormFocusTargets,
) {
  const toast = useToast();
  const confirm = useConfirm();
  const isEdit = Boolean(editLogId);
  const [today] = useState(() => todayKey());
  const [startDate] = useState(() => (initialDate && isDateKey(initialDate) ? initialDate : today));

  const [dish, setDish] = useState<DishChoice | null>(null);
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState<MealType>(() => defaultMeal(startDate, today));
  const [mealTouched, setMealTouched] = useState(false);
  const [date, setDate] = useState(startDate);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<PhotoChange>(undefined);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [dishError, setDishError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const recipes = useRecipes();
  const existing = useLog(editLogId ?? null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (existing && loadedId !== existing.id) {
    // Adopt the stored entry once it loads; later live updates must not clobber edits.
    setLoadedId(existing.id);
    setDish({ recipeId: existing.recipeId, name: existing.dishName });
    setMeal(existing.mealType);
    setMealTouched(true);
    setDate(existing.date);
    setNotes(existing.notes);
  }

  const initialRecipe = useRecipe(isEdit ? null : (initialRecipeId ?? null));
  const [preselectedId, setPreselectedId] = useState<string | null>(null);
  if (initialRecipe && preselectedId !== initialRecipe.id) {
    setPreselectedId(initialRecipe.id);
    if (!dish && !query) setDish({ recipeId: initialRecipe.id, name: initialRecipe.title });
  }

  const chooseDish = (choice: DishChoice | null) => {
    setDish(choice);
    if (choice) setDishError(null);
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    if (next.trim()) setDishError(null);
  };

  const chooseMeal = (next: MealType) => {
    setMeal(next);
    setMealTouched(true);
  };

  const chooseDate = (next: string) => {
    setDate(next);
    setDateError(null);
    // Until the meal is picked by hand, keep it sensible for the chosen day.
    if (!mealTouched && isDateKey(next)) setMeal(defaultMeal(next, today));
  };

  const choosePhoto = (next: PhotoInput | null) => setPhoto(next);

  const save = async () => {
    if (status !== "idle" || photoBusy) return;
    let choice = dish;
    const typed = query.trim();
    if (!choice && typed) {
      // Typed but not picked: use the matching recipe if the name is exact, else a custom dish.
      const match = findExactRecipe(recipes ?? [], typed);
      choice = match ? { recipeId: match.id, name: match.title } : { recipeId: null, name: typed };
    }
    if (!choice) {
      setDishError("Pick a recipe or type what you cooked.");
      focusTargets.dishInput.current?.focus();
      return;
    }
    if (!isDateKey(date)) {
      setDateError("Choose the day you cooked it.");
      focusTargets.dateInput.current?.focus();
      return;
    }
    setStatus("saving");
    const input: CookLogInput = { date, mealType: meal, recipeId: choice.recipeId, dishName: choice.name, notes };
    try {
      const log = editLogId ? await updateLog(editLogId, input, photo) : await createLog(input, photo ?? null);
      toast.show(
        editLogId
          ? { title: "Entry updated", tone: "success" }
          : {
              title: `Logged ${log.dishName} · ${MEAL_LABELS[log.mealType]}`,
              description: log.date === today ? undefined : formatDayLabel(log.date),
              tone: "success",
            },
      );
      onSaved?.(log);
      onClose();
    } catch {
      setStatus("idle");
      toast.show({ title: "Couldn't save this entry", description: "Please try again.", tone: "danger" });
      requestAnimationFrame(() => focusTargets.save.current?.focus());
    }
  };

  const remove = async () => {
    if (!editLogId || status !== "idle") return;
    const confirmed = await confirm({
      title: "Delete this entry?",
      body: "Its notes and plate photo will be deleted too.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    setStatus("deleting");
    try {
      const snapshot = await deleteLog(editLogId);
      if (snapshot) {
        toast.show({
          title: "Entry deleted",
          action: {
            label: "Undo",
            onClick: () => {
              undoDeleteLog(snapshot).catch(() => toast.show({ title: "Couldn't restore the entry", tone: "danger" }));
            },
          },
        });
      }
      onClose();
    } catch {
      setStatus("idle");
      toast.show({ title: "Couldn't delete this entry", description: "Please try again.", tone: "danger" });
    }
  };

  return {
    isEdit,
    /** Edit mode: the entry is still loading. */
    loading: isEdit && existing === undefined,
    /** Edit mode: the entry no longer exists (e.g. deleted in another tab). */
    missing: isEdit && existing === null && status === "idle",
    today,
    recipes,
    dish,
    chooseDish,
    query,
    changeQuery,
    dishError,
    meal,
    chooseMeal,
    date,
    chooseDate,
    dateError,
    notes,
    setNotes,
    photo,
    choosePhoto,
    existingPhotoId: existing?.photoId ?? null,
    photoBusy,
    setPhotoBusy,
    status,
    save,
    remove,
  };
}
