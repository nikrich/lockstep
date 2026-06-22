// Authentication: resolve the caller's Identity from either a Personal Access
// Token (machines: git/CLI/UE/CI) or a signed session cookie (dashboard).
//
// Two surfaces, two mechanisms:
//   - PAT   -> HTTP Basic / Bearer, validated against tokens.token_hash (D1),
//              with a KV cache so the hot path is a single KV read.
//   - OAuth -> dashboard login mints a session stored in KV; cookie is HMAC
//              signed so it can't be forged.
import type { Context, MiddlewareHandler } from "hono";
import type { Env, Identity, User, Vars } from "./types";
import { sha256, hmac, timingSafeEqual } from "./crypto";

const TOKEN_CACHE_TTL = 60; // seconds; short so revocation propagates quickly

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

// --- Sessions (dashboard) ---

const SESSION_COOKIE = "ls_session";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

export async function createSession(env: Env, userId: string): Promise<string> {
  const sid = crypto.randomUUID();
  await env.SESSIONS.put(`sess:${sid}`, userId, { expirationTtl: SESSION_TTL });
  const sig = await hmac(env.SESSION_SECRET, sid);
  return `${sid}.${sig}`;
}

export function sessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

export const clearSessionCookie = `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

async function identityFromSession(c: Ctx): Promise<Identity | null> {
  const raw = getCookie(c.req.raw.headers.get("Cookie"), SESSION_COOKIE);
  if (!raw) return null;
  const [sid, sig] = raw.split(".");
  if (!sid || !sig) return null;
  if (!timingSafeEqual(sig, await hmac(c.env.SESSION_SECRET, sid))) return null;

  const userId = await c.env.SESSIONS.get(`sess:${sid}`);
  if (!userId) return null;

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<User>();
  if (!user) return null;
  return { userId, name: ownerName(user), via: "session" };
}

// --- Personal Access Tokens (machines) ---

async function identityFromToken(c: Ctx): Promise<Identity | null> {
  const secret = extractToken(c.req.raw.headers.get("Authorization"));
  if (!secret) return null;

  const hash = await sha256(secret);

  // Hot path: KV cache. Value is "userId|ownerName".
  const cached = await c.env.SESSIONS.get(`tok:${hash}`);
  if (cached) {
    const [userId, name] = cached.split("|");
    if (userId && name) return { userId, name, via: "token" };
  }

  const row = await c.env.DB.prepare(
    `SELECT t.user_id AS userId, t.expires_at AS expiresAt, u.*
       FROM tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ?`,
  )
    .bind(hash)
    .first<User & { userId: string; expiresAt: number | null }>();
  if (!row) return null;
  if (row.expiresAt && row.expiresAt < nowSec()) return null;

  const name = ownerName(row);
  // Refresh the cache + last_used in the background. executionCtx isn't present
  // when the Worker is invoked via app.fetch(req, env) (e.g. tests), so guard it.
  const bg = Promise.all([
    c.env.SESSIONS.put(`tok:${hash}`, `${row.userId}|${name}`, {
      expirationTtl: TOKEN_CACHE_TTL,
    }),
    c.env.DB.prepare("UPDATE tokens SET last_used_at = ? WHERE token_hash = ?")
      .bind(nowSec(), hash)
      .run(),
  ]);
  try {
    c.executionCtx.waitUntil(bg);
  } catch {
    await bg;
  }
  return { userId: row.userId, name, via: "token" };
}

// --- Middleware ---

/** Require auth; 401 if neither a valid PAT nor session is present. */
export function requireAuth(): MiddlewareHandler<{ Bindings: Env; Variables: Vars }> {
  return async (c, next) => {
    const id = (await identityFromToken(c)) ?? (await identityFromSession(c));
    if (!id) {
      return c.json({ message: "authentication required" }, 401, {
        // Prompt git's credential helper to supply a PAT.
        "WWW-Authenticate": 'Basic realm="Lockstep"',
      });
    }
    c.set("identity", id);
    await next();
  };
}

// --- helpers ---

export function ownerName(u: Partial<User>): string {
  return u.email || u.name || `${u.provider}:${u.provider_id}`;
}

function extractToken(authz: string | null): string | null {
  if (!authz) return null;
  if (authz.startsWith("Bearer ")) return authz.slice(7).trim();
  if (authz.startsWith("Basic ")) {
    // git sends Basic base64(user:token). The PAT may be in either field.
    try {
      const [user, pass] = atob(authz.slice(6)).split(":");
      const cand = pass || user || "";
      return cand.startsWith("lsk_") ? cand : pass || null;
    } catch {
      return null;
    }
  }
  return null;
}

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const nowSec = (): number => Math.floor(Date.now() / 1000);
