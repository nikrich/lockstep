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

// --- Envelope encryption for org storage secrets (AES-256-GCM) ---
//
// The master key is a 32-byte value provided as base64 in env.LOCKSTEP_MASTER_KEY.
// Org bucket secrets are encrypted with it and stored as "iv:ciphertext" (both
// base64). Only the Worker holds the master key, so only the Worker can decrypt
// a bucket secret to presign — clients never receive it.

const b64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));
const unb64 = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function importAesKey(masterKeyB64: string): Promise<CryptoKey> {
  const raw = unb64(masterKeyB64);
  if (raw.length !== 32) throw new Error("LOCKSTEP_MASTER_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt a secret. Returns "iv:ciphertext" (base64 each). */
export async function aesEncrypt(masterKeyB64: string, plaintext: string): Promise<string> {
  const key = await importAesKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${b64(iv)}:${b64(new Uint8Array(ct))}`;
}

/** Decrypt an "iv:ciphertext" blob produced by aesEncrypt. */
export async function aesDecrypt(masterKeyB64: string, blob: string): Promise<string> {
  const [ivB64, ctB64] = blob.split(":");
  if (!ivB64 || !ctB64) throw new Error("malformed ciphertext");
  const key = await importAesKey(masterKeyB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivB64) },
    key,
    unb64(ctB64),
  );
  return new TextDecoder().decode(pt);
}

/** Generate a fresh 32-byte master key as base64 (for `wrangler secret put`). */
export function generateMasterKey(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}
