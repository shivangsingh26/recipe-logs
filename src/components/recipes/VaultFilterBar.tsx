"use client";

import { Star } from "lucide-react";
import { useEffect, useRef } from "react";
import { Chip } from "@/components/ui/Chip";
import { categoryFilter, type RecipeSort, type VaultFilter } from "@/lib/recipes/query";
import { SortPicker } from "./SortPicker";

export interface VaultFilterBarProps {
  /** Categories in use, most common first. */
  categories: readonly string[];
  filter: VaultFilter;
  sort: RecipeSort;
  onFilterChange: (filter: VaultFilter) => void;
  onSortChange: (sort: RecipeSort) => void;
}

/** Sort chip + single-select filter chips, scrolling edge to edge under the search field. */
export function VaultFilterBar({ categories, filter, sort, onFilterChange, onSortChange }: VaultFilterBarProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const categoriesShown = categories.length > 0;

  // A remembered selection may sit off-screen to the right: bring it into view once the chips exist.
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>("[data-filter][aria-pressed='true']");
    if (!row || !chip) return;
    const rowBox = row.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    if (chipBox.right > rowBox.right || chipBox.left < rowBox.left) {
      row.scrollLeft += chipBox.left - rowBox.left - (rowBox.width - chipBox.width) / 2;
    }
  }, [categoriesShown]);

  // Tapping the active chip again goes back to "All".
  const choose = (next: VaultFilter) => onFilterChange(filter === next ? "all" : next);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label="Sort and filter"
      className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto pl-4 scrollbar-none"
    >
      <SortPicker value={sort} onChange={onSortChange} />
      <span aria-hidden className="h-5 w-px shrink-0 bg-line-strong" />
      <Chip data-filter selected={filter === "all"} onClick={() => onFilterChange("all")}>
        All
      </Chip>
      <Chip
        data-filter
        selected={filter === "favorites"}
        icon={<Star aria-hidden className={filter === "favorites" ? "fill-current" : undefined} />}
        onClick={() => choose("favorites")}
      >
        Favorites
      </Chip>
      {categories.map((category) => {
        const value = categoryFilter(category);
        return (
          <Chip key={category} data-filter selected={filter === value} onClick={() => choose(value)}>
            {category}
          </Chip>
        );
      })}
      {/* Trailing space: Safari ignores end padding inside horizontal scrollers. */}
      <span aria-hidden className="w-2 shrink-0" />
    </div>
  );
}
