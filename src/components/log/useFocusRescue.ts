import { useEffect, useRef, type FocusEvent, type RefObject } from "react";

/**
 * Keeps keyboard/screen-reader focus from dropping to <body> when the focused element of a
 * list disappears (e.g. an entry deleted from its edit sheet): focus moves to `fallback`.
 * Spread the returned handlers onto the list container; `items` is the rendered list.
 */
export function useFocusRescue(fallback: RefObject<HTMLElement | null>, items: unknown) {
  const hadFocus = useRef(false);

  useEffect(() => {
    if (!hadFocus.current) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    hadFocus.current = false;
    fallback.current?.focus({ preventScroll: true });
  }, [items, fallback]);

  return {
    onFocus: () => {
      hadFocus.current = true;
    },
    onBlur: (e: FocusEvent) => {
      // A removed element blurs with no relatedTarget; keep the flag so the effect can rescue.
      if (e.relatedTarget) hadFocus.current = false;
    },
  };
}
