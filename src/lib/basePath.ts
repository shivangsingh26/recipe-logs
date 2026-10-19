/** Deploy sub-path ("" or e.g. "/recipe-logs"), baked in at build time. */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/**
 * Prefixes a root-relative public asset path with the base path. Needed for raw URLs
 * (service worker, manifest, <img src> in plain tags); next/link and next/navigation
 * add the base path themselves.
 */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
