"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

export interface SheetProps {
  open: boolean;
  /** Called on Esc, backdrop tap and the close button. The parent owns `open`. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row (e.g. Cancel / Save), kept above the home indicator. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Modal bottom sheet on phones, centred dialog on wider screens. Built on the native
 * <dialog> (focus trap, Esc, inert background and top layer for free). Children only
 * mount while open, so forms inside start fresh every time.
 */
export function Sheet({ open, onClose, title, description, children, footer, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Keep the page behind from scrolling while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[92dvh] w-full max-w-xl overflow-hidden p-0",
        "rounded-t-[28px] border border-b-0 border-line bg-surface text-ink shadow-float",
        "open:flex open:flex-col open:animate-sheet-in backdrop:bg-black/45 backdrop:animate-fade-in",
        "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:rounded-[28px] sm:border-b",
        className,
      )}
    >
      {open && (
        <>
          <div className="shrink-0 px-5 pb-3 pt-2.5">
            <div aria-hidden className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 pt-1.5">
                <h2 id={titleId} className="text-lg font-semibold leading-snug">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-0.5 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              <IconButton label="Close" size="sm" variant="secondary" onClick={onClose}>
                <X />
              </IconButton>
            </div>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5",
              footer ? "pb-4" : "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            )}
          >
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-line bg-surface px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              {footer}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
