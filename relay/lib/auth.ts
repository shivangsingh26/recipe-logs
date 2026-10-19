// Secrets. The app makes a random inbox token and gives it to the Shortcut; the relay only ever
// stores its SHA-256 (the inbox id). Pairing a new inbox needs the deployment's pairing code,
// and every inbox remembers a fingerprint of the code it was paired with, so changing
// PAIRING_CODE revokes all of them at once.

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

/** The bearer token from `Authorization: Bearer <token>`, if it is well formed. */
export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec((request.headers.get("authorization") ?? "").trim());
  return match && TOKEN_RE.test(match[1]) ? match[1] : null;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison (of the two SHA-256 digests, so lengths never leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function pairingFingerprint(pairingCode: string): Promise<string> {
  return (await sha256Hex(`culinarylog-relay:${pairingCode}`)).slice(0, 32);
}
