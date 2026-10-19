// Byte helpers: base64 data URLs (photos embedded in JSON exports) and file-type sniffing.

// String.fromCharCode(...bytes) has an argument-count limit, so encode in slices.
const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Throws on malformed base64. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toDataUrl(buffer: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

/** Decodes a base64 data URL (or bare base64). Returns null for anything else. */
export function fromDataUrl(value: unknown): { bytes: Uint8Array<ArrayBuffer>; mime: string | null } | null {
  if (typeof value !== "string" || value.length === 0) return null;
  let mime: string | null = null;
  let payload = value;
  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    if (comma < 0) return null;
    const header = value.slice(5, comma).split(";");
    if (!header.includes("base64")) return null;
    mime = header[0] || null;
    payload = value.slice(comma + 1);
  }
  try {
    const bytes = base64ToBytes(payload);
    return bytes.length > 0 ? { bytes, mime } : null;
  } catch {
    return null;
  }
}

/** Copies a view into a standalone ArrayBuffer of exactly its length (what IndexedDB stores). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/** ZIP local-file, empty-archive and spanned-archive signatures all start with "PK". */
export function isZip(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const pair = (bytes[2] << 8) | bytes[3];
  return pair === 0x0304 || pair === 0x0506 || pair === 0x0708;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
};

export function extensionForMime(mime: string): string {
  return EXTENSIONS[mime.toLowerCase()] ?? "jpg";
}
