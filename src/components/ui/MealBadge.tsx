import { Coffee, Cookie, Sandwich, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { MEAL_LABELS, type MealType } from "@/lib/types";

/** Full class names (not built dynamically) so Tailwind can see them. */
export const MEAL_STYLES: Record<MealType, { icon: LucideIcon; text: string; dot: string; soft: string; ring: string }> = {
  breakfast: {
    icon: Coffee,
    text: "text-meal-breakfast",
    dot: "bg-meal-breakfast",
    soft: "bg-meal-breakfast/12",
    ring: "ring-meal-breakfast",
  },
  lunch: { icon: Sandwich, text: "text-meal-lunch", dot: "bg-meal-lunch", soft: "bg-meal-lunch/12", ring: "ring-meal-lunch" },
  snack: { icon: Cookie, text: "text-meal-snack", dot: "bg-meal-snack", soft: "bg-meal-snack/12", ring: "ring-meal-snack" },
  dinner: {
    icon: UtensilsCrossed,
    text: "text-meal-dinner",
    dot: "bg-meal-dinner",
    soft: "bg-meal-dinner/12",
    ring: "ring-meal-dinner",
  },
};

export function MealBadge({ meal, className }: { meal: MealType; className?: string }) {
  const style = MEAL_STYLES[meal];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        style.soft,
        style.text,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {MEAL_LABELS[meal]}
    </span>
  );
}

export function MealDot({ meal, className }: { meal: MealType; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-1.5 rounded-full", MEAL_STYLES[meal].dot, className)} />;
}
