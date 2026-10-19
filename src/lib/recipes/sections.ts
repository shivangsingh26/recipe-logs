// Groups consecutive ingredients/steps that share a `group` into display sections, keeping
// the author's order exactly (a group that appears twice becomes two sections).

export interface SectionEntry<T> {
  item: T;
  /** Position in the full list (steps are numbered across sections). */
  index: number;
}

export interface Section<T> {
  /** Sub-heading, or null for items without a group. */
  group: string | null;
  entries: Array<SectionEntry<T>>;
}

export function groupIntoSections<T extends { group?: string }>(items: readonly T[]): Array<Section<T>> {
  const sections: Array<Section<T>> = [];
  items.forEach((item, index) => {
    const group = item.group?.trim() || null;
    const last = sections[sections.length - 1];
    if (last && last.group === group) last.entries.push({ item, index });
    else sections.push({ group, entries: [{ item, index }] });
  });
  return sections;
}
