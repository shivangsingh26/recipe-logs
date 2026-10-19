import { Clock, CookingPot, Hourglass, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatMinutes, formatNumber } from "@/lib/format";
import type { Recipe } from "@/lib/types";

interface Fact {
  label: string;
  value: string;
  icon: LucideIcon;
}

/** Prep · Cook · Total · Serves, hiding whatever is unknown. */
export function RecipeFacts({ recipe }: { recipe: Recipe }) {
  const { prepMinutes, cookMinutes, servings } = recipe;
  // A total only adds information when both parts are known.
  const total = prepMinutes != null && cookMinutes != null ? prepMinutes + cookMinutes : null;
  const facts: Fact[] = [
    { label: "Prep", value: formatMinutes(prepMinutes), icon: Hourglass },
    { label: "Cook", value: formatMinutes(cookMinutes), icon: CookingPot },
    { label: "Total", value: formatMinutes(total), icon: Clock },
    { label: "Serves", value: servings != null && servings > 0 ? formatNumber(servings) : "", icon: Users },
  ].filter((fact) => fact.value !== "");
  if (facts.length === 0) return null;

  return (
    <Card>
      <dl className="flex divide-x divide-line">
        {facts.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 flex-1 flex-col items-center px-1 py-3 text-center">
            <Icon aria-hidden className="mb-1 size-[18px] text-accent" strokeWidth={1.8} />
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold leading-tight text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
