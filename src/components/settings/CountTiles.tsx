import type { BackupCounts } from "@/lib/backup";

function Tile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-2xl font-semibold leading-none tabular-nums text-ink">{value ?? "–"}</dd>
    </div>
  );
}

/** Recipes / log entries / photos as three small tiles; dashes while `counts` loads. */
export function CountTiles({ counts }: { counts: BackupCounts | undefined }) {
  return (
    <dl className="grid grid-cols-3 gap-2" aria-busy={counts === undefined}>
      <Tile label="Recipes" value={counts?.recipes} />
      <Tile label="Log entries" value={counts?.logs} />
      <Tile label="Photos" value={counts?.photos} />
    </dl>
  );
}
