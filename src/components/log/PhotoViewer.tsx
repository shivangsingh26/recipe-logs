"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Skeleton";
import { usePhotoUrl } from "@/lib/db";

export interface PhotoViewerProps {
  photoId: string;
  /** Dish name, shown as the title and used for the image's alt text. */
  title: string;
  caption?: string;
  /** Called after the viewer has closed (Esc, close button, tap outside the photo). */
  onClose: () => void;
}

/** Full-screen plate photo. Mount it to open; it closes itself and then calls onClose. */
export function PhotoViewer({ photoId, title, caption, onClose }: PhotoViewerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const url = usePhotoUrl(photoId, "full");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  // Closing through the element lets the browser restore focus to the thumbnail first.
  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      aria-label={`Plate photo: ${title}`}
      onClose={onClose}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-canvas p-0 text-ink open:flex open:flex-col open:animate-fade-in backdrop:bg-canvas"
    >
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg font-semibold leading-snug">{title}</p>
          {caption && <p className="truncate text-sm text-muted">{caption}</p>}
        </div>
        <IconButton label="Close photo" variant="secondary" onClick={close}>
          <X />
        </IconButton>
      </div>
      <div
        className="relative min-h-0 flex-1"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL of a photo stored on the device
          <img
            src={url}
            alt={`Plate photo of ${title}`}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <Spinner label="Loading photo" className="size-7" />
          </div>
        )}
      </div>
    </dialog>
  );
}
