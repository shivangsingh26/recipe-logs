"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { usePhotoUrl } from "@/lib/db";
import { processImage } from "@/lib/image";
import type { PhotoInput } from "@/lib/types";

/** undefined = keep the stored photo, null = no photo (or removed), PhotoInput = newly picked. */
export type PhotoChange = PhotoInput | null | undefined;

export interface PhotoFieldProps {
  /** Photo already stored for the entry being edited. */
  existingPhotoId: string | null;
  value: PhotoChange;
  onChange: (value: PhotoInput | null) => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  /** id of the visible label for the group. */
  labelledBy: string;
}

/** Plate photo: take or choose one, preview it, replace or remove it. */
export function PhotoField({ existingPhotoId, value, onChange, busy, onBusyChange, labelledBy }: PhotoFieldProps) {
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const existingUrl = usePhotoUrl(value === undefined ? existingPhotoId : null, "thumb");
  const hasPhoto = value ? true : value === undefined && existingPhotoId !== null;

  // The trigger buttons are swapped out while a photo is processed or removed: put focus back.
  useEffect(() => {
    if (!restoreFocus.current || busy) return;
    restoreFocus.current = false;
    (replaceRef.current ?? takeRef.current)?.focus();
  }, [busy, hasPhoto]);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // picking the same file again must still fire "change"
    if (!file) return;
    restoreFocus.current = true;
    onBusyChange(true);
    try {
      onChange(await processImage(file));
    } catch (error) {
      toast.show({
        title: "Couldn't add that photo",
        description: error instanceof Error ? error.message : undefined,
        tone: "danger",
      });
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div role="group" aria-labelledby={labelledBy}>
      {busy ? (
        <div
          role="status"
          className="flex h-28 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm text-muted"
        >
          <Spinner className="size-5" />
          Preparing photo…
        </div>
      ) : hasPhoto ? (
        <div className="flex items-center gap-4">
          <div className="size-28 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
            {value ? (
              <NewPhotoPreview photo={value} />
            ) : (
              existingUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- blob: URL of a photo stored on the device
                <img src={existingUrl} alt="Current plate photo" className="size-full object-cover" />
              )
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Button ref={replaceRef} variant="secondary" icon={<ImagePlus />} onClick={() => libraryRef.current?.click()}>
              Replace
            </Button>
            <Button
              variant="ghost"
              icon={<X />}
              onClick={() => {
                restoreFocus.current = true;
                onChange(null);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button ref={takeRef} variant="secondary" icon={<Camera />} onClick={() => cameraRef.current?.click()}>
            Take photo
          </Button>
          <Button variant="secondary" icon={<ImagePlus />} onClick={() => libraryRef.current?.click()}>
            Choose photo
          </Button>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={onPick}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={onPick}
      />
    </div>
  );
}

/** A picked photo isn't stored yet, so it is previewed through its own short-lived object URL. */
function NewPhotoPreview({ photo }: { photo: PhotoInput }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    const url = URL.createObjectURL(new Blob([photo.thumb], { type: photo.mime }));
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  // eslint-disable-next-line @next/next/no-img-element -- blob: URL set imperatively above
  return <img ref={ref} alt="New plate photo" className="size-full object-cover" />;
}
