import { Card, SectionLabel } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { calorieShare, hasAnyMacro, type CalorieShare } from "@/lib/recipes/nutrition";
import type { Macros } from "@/lib/types";

const TILES: ReadonlyArray<{ key: keyof Macros; label: string; unit: string; dot: string }> = [
  { key: "calories", label: "Calories", unit: "kcal", dot: "bg-macro-kcal" },
  { key: "protein", label: "Protein", unit: "g", dot: "bg-macro-protein" },
  { key: "carbs", label: "Carbs", unit: "g", dot: "bg-macro-carbs" },
  { key: "fat", label: "Fat", unit: "g", dot: "bg-macro-fat" },
];

/** Per-serving macros, plus where the calories come from. Hidden when nothing is known. */
export function MacrosCard({ macros }: { macros: Macros }) {
  if (!hasAnyMacro(macros)) return null;
  const share = calorieShare(macros);
  return (
    <Card className="p-4">
      <SectionLabel>Per serving</SectionLabel>
      <dl className="mt-3 grid grid-cols-4 gap-2">
        {TILES.map((tile) => {
          const value = macros[tile.key];
          return (
            <div key={tile.key} className="rounded-xl bg-surface-2 px-1 py-2.5 text-center">
              <dt className="flex items-center justify-center gap-1 text-[11px] font-medium text-muted">
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", tile.dot)} />
                {tile.label}
              </dt>
              <dd className="mt-1 text-[17px] font-semibold leading-tight tabular-nums text-ink">
                {value == null ? (
                  <>
                    <span aria-hidden>–</span>
                    <span className="sr-only">unknown</span>
                  </>
                ) : (
                  <>
                    {formatNumber(value, tile.key === "calories" ? 0 : 1)}
                    <span className="ml-0.5 text-[11px] font-medium text-muted">{tile.unit}</span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {share && <CalorieShareBar share={share} />}
    </Card>
  );
}

function CalorieShareBar({ share }: { share: CalorieShare }) {
  const parts = [
    { label: "Protein", value: share.protein, color: "bg-macro-protein" },
    { label: "Carbs", value: share.carbs, color: "bg-macro-carbs" },
    { label: "Fat", value: share.fat, color: "bg-macro-fat" },
  ];
  const percent = (value: number) => Math.round(value * 100);
  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label={`Calories from ${parts.map((p) => `${p.label.toLowerCase()} ${percent(p.value)}%`).join(", ")}`}
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
      >
        {parts.map((p) => (
          <span key={p.label} className={cn("h-full", p.color)} style={{ width: `${p.value * 100}%` }} />
        ))}
      </div>
      <ul aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", p.color)} />
            {p.label} {percent(p.value)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
