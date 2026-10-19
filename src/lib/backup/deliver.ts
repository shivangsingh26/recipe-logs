// Getting an exported file off the device: the native share sheet on phones (Save to
// Files, Google Drive, WhatsApp…), a plain download everywhere else.

export type DeliveryOutcome = "shared" | "downloaded" | "cancelled" | "needs-tap";

function errorName(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "name" in error ? String(error.name) : undefined;
}

/**
 * Share sheets on phones and tablets can save to Files/Drive; desktop share sheets can't
 * save to disk at all, so a download is the better default there.
 */
function canUseShareSheet(file: File): boolean {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Hands a file to the person. "cancelled" = they closed the share sheet (not an error).
 * "needs-tap" = the browser refused to open the share sheet because the tap that started
 * a slow export has expired; call again from a fresh tap (or fall back to downloadFile).
 */
export async function deliverFile(file: File, title: string = file.name): Promise<DeliveryOutcome> {
  if (canUseShareSheet(file)) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      const name = errorName(error);
      if (name === "AbortError") return "cancelled";
      if (name === "NotAllowedError") return "needs-tap";
      // Anything else (type not shareable after all, target failed): download instead.
    }
  }
  downloadFile(file);
  return "downloaded";
}
