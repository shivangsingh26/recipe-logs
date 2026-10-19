"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/ids";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: "default" | "success" | "danger";
  /** e.g. { label: "Undo", onClick } — the toast closes after the action runs. */
  action?: { label: string; onClick: () => void };
  /** ms before auto-dismiss; Infinity keeps it until dismissed. Default 3.5 s (6 s with an action). */
  duration?: number;
  /** Re-using an id replaces that toast instead of stacking a new one. */
  id?: string;
}

interface ToastItem extends ToastOptions {
  id: string;
}

export interface ToastApi {
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());
  const regionRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? newId();
      setItems((list) => [...list.filter((t) => t.id !== id), { ...options, id }].slice(-MAX_VISIBLE));
      const previous = timers.current.get(id);
      if (previous) window.clearTimeout(previous);
      const duration = options.duration ?? (options.action ? 6000 : 3500);
      if (Number.isFinite(duration)) timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  // Promote the region into the top layer (Popover API) so toasts stay visible
  // above any open <dialog>. Falls back to plain fixed positioning.
  useEffect(() => {
    const region = regionRef.current;
    if (!region || typeof region.showPopover !== "function") return;
    try {
      if (region.matches(":popover-open")) region.hidePopover();
      if (items.length > 0) region.showPopover();
    } catch {
      // Popover unsupported in this context: fixed positioning still works.
    }
  }, [items]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        ref={regionRef}
        popover="manual"
        aria-live="polite"
        aria-label="Notifications"
        // Browsers without the Popover API ignore the attribute and show a plain fixed region.
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-above-nav top-auto z-[70] m-0 flex w-full flex-col items-center gap-2",
          "overflow-visible border-0 bg-transparent p-0 px-4 text-ink",
        )}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "danger" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-md animate-toast-in items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-float"
          >
            {t.tone === "success" && <CircleCheck aria-hidden className="size-5 shrink-0 text-success" />}
            {t.tone === "danger" && <CircleAlert aria-hidden className="size-5 shrink-0 text-danger" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs leading-snug opacity-75">{t.description}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent-hover transition-opacity active:opacity-60 dark:text-accent"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
