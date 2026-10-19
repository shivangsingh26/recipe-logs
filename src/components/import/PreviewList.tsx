"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { splitBold } from "@/lib/markdown/inline";

const COLLAPSED_COUNT = 5;

export interface PreviewListProps {
  title: string;
  items: ReadonlyArray<{ text: string; group?: string }>;
  ordered?: boolean;
}

/** Parsed ingredients or steps: the first five, sub-group labels, and a "Show all" toggle. */
export function PreviewList({ title, items, ordered = false }: PreviewListProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const List = ordered ? "ol" : "ul";

  return (
    <section className="border-t border-line px-4 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        {title} <span className="font-medium normal-case tracking-normal">· {items.length}</span>
      </h3>
      <List id={listId} className="flex flex-col gap-2">
        {visible.map((item, index) => {
          const showGroup = item.group && item.group !== visible[index - 1]?.group;
          return (
            <Fragment key={index}>
              {showGroup && (
                <li aria-hidden className="pt-1 text-[13px] font-semibold text-on-accent-soft">
                  {item.group}
                </li>
              )}
              <li className="flex gap-2.5 text-[15px] leading-snug text-ink">
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 tabular-nums text-muted",
                    ordered ? "w-5 text-right text-sm font-semibold leading-[1.45]" : "mt-[0.55em] size-1.5 rounded-full bg-subtle",
                  )}
                >
                  {ordered ? index + 1 : null}
                </span>
                <span className="min-w-0 whitespace-pre-line">
                  {item.group && <span className="sr-only">{item.group}: </span>}
                  {splitBold(item.text).map((run, i) =>
                    run.bold ? (
                      <strong key={i} className="font-semibold">
                        {run.text}
                      </strong>
                    ) : (
                      <Fragment key={i}>{run.text}</Fragment>
                    ),
                  )}
                </span>
              </li>
            </Fragment>
          );
        })}
      </List>
      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 -ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-on-accent-soft active:bg-accent-soft"
        >
          {expanded ? "Show less" : `Show all ${items.length}`}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
