// Plate-photo pipeline: decode (honouring EXIF orientation), downscale and re-encode as JPEG so
// photos stay small in IndexedDB. Browser-only, except the pure sizing helper `fitWithin`.

import type { PhotoInput } from "./types";

export const FULL_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 480;
const FULL_QUALITY = 0.82;
const THUMB_QUALITY = 0.75;
const JPEG = "image/jpeg";

export const NOT_AN_IMAGE_MESSAGE = "Not an image";
export const UNSUPPORTED_IMAGE_MESSAGE = "This photo format isn't supported on this device";

export interface Size {
  width: number;
  height: number;
}

/** Scales (never up) so the longest edge is ≤ `max`, keeping the aspect ratio. Whole pixels, at least 1. */
export function fitWithin(width: number, height: number, max: number): Size {
  if (!(width > 0 && height > 0 && max > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError(`Invalid image size: ${width}×${height} (max ${max})`);
  }
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.min(Math.round(width * scale), Math.floor(max))),
    height: Math.max(1, Math.min(Math.round(height * scale), Math.floor(max))),
  };
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decodeWithBitmap(file: Blob): Promise<Decoded | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    return null;
  }
}

/** Fallback for engines whose createImageBitmap can't decode the file (or lacks options support). */
async function decodeWithElement(file: Blob): Promise<Decoded | null> {
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

type DrawingContext = CanvasDrawImage & CanvasRect & CanvasFillStrokeStyles & CanvasImageSmoothing;

interface Surface {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: DrawingContext;
}

function createSurface({ width, height }: Size): Surface {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx) return { canvas, ctx };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  return { canvas, ctx };
}

function drawScaled(source: CanvasImageSource, size: Size): Surface {
  const surface = createSurface(size);
  const { ctx } = surface;
  // JPEG has no alpha channel: flatten transparent images onto white rather than black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return surface;
}

async function encodeJpeg(canvas: OffscreenCanvas | HTMLCanvasElement, quality: number): Promise<ArrayBuffer> {
  const blob =
    "convertToBlob" in canvas
      ? await canvas.convertToBlob({ type: JPEG, quality })
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, JPEG, quality));
  if (!blob) throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  return blob.arrayBuffer();
}

/**
 * Turns a picked/captured photo into the stored pair: full (≤ 1600 px, JPEG ~0.82) and
 * thumbnail (≤ 480 px, JPEG ~0.75). Width/height describe the full-size image.
 */
export async function processImage(file: Blob): Promise<PhotoInput> {
  // Some pickers report an empty type; let the decoder decide for those.
  if (file.type && !file.type.startsWith("image/")) throw new Error(NOT_AN_IMAGE_MESSAGE);
  const decoded = (await decodeWithBitmap(file)) ?? (await decodeWithElement(file));
  if (!decoded) throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  try {
    if (!(decoded.width > 0 && decoded.height > 0)) throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
    const fullSize = fitWithin(decoded.width, decoded.height, FULL_MAX_EDGE);
    const full = drawScaled(decoded.source, fullSize);
    // Scaling the thumbnail from the already reduced image is faster and smoother.
    const thumb = drawScaled(full.canvas, fitWithin(fullSize.width, fullSize.height, THUMB_MAX_EDGE));
    const [data, thumbData] = await Promise.all([
      encodeJpeg(full.canvas, FULL_QUALITY),
      encodeJpeg(thumb.canvas, THUMB_QUALITY),
    ]);
    return { mime: JPEG, data, thumb: thumbData, width: fullSize.width, height: fullSize.height };
  } finally {
    decoded.release();
  }
}
