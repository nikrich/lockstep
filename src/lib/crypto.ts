// Small crypto helpers built on the Workers WebCrypto API (no deps).

const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** SHA-256 of a UTF-8 string, hex-encoded. Used to store PATs as hashes. */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return hex(await crypto.subtle.digest("SHA-256", data));
}

/** Cryptographically-random URL-safe id (default 256 bits). */
export function randomId(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A UUID for primary keys. */
export const uuid = (): string => crypto.randomUUID();

/** Issue a Personal Access Token. Returns the plaintext (shown once) + hash. */
export async function newToken(): Promise<{ secret: string; hash: string }> {
  const secret = `lsk_${randomId(24)}`; // lsk_ = Lockstep key
  return { secret, hash: await sha256(secret) };
}

/** Constant-time string comparison to avoid timing leaks on secrets. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** HMAC-SHA256 signature (hex) used to sign session cookies. */
export async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return hex(sig);
}
