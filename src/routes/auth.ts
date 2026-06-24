// Dashboard OAuth login routes: /auth/:provider and /auth/:provider/callback.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { authorizeUrl, exchange, upsertUser, type Provider } from "../lib/oauth";
import { createSession, sessionCookie, clearSessionCookie, requireAuth } from "../lib/auth";
import { randomId } from "../lib/crypto";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const OAUTH_STATE_TTL = 600; // seconds

function isProvider(p: string): p is Provider {
  return p === "github" || p === "google";
}

// Current signed-in user (session cookie or PAT). Registered before /:provider
// so the static path wins. The dashboard calls this to know who's logged in.
app.get("/me", requireAuth(), async (c) => {
  const id = c.get("identity");
  const user = await c.env.DB.prepare(
    "SELECT id, email, name, provider, avatar_url FROM users WHERE id = ?",
  )
    .bind(id.userId)
    .first();
  return c.json({ user, via: id.via });
});

// Kick off login: stash a CSRF state token in KV, redirect to the provider.
app.get("/:provider", async (c) => {
  const provider = c.req.param("provider");
  if (!isProvider(provider)) return c.json({ message: "unknown provider" }, 404);

  const state = randomId(16);
  await c.env.SESSIONS.put(`oauth:${state}`, provider, {
    expirationTtl: OAUTH_STATE_TTL,
  });
  return c.redirect(authorizeUrl(c.env, provider, state));
});

// Provider redirects back here with ?code & ?state.
app.get("/:provider/callback", async (c) => {
  const provider = c.req.param("provider");
  if (!isProvider(provider)) return c.json({ message: "unknown provider" }, 404);

  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.json({ message: "missing code/state" }, 400);

  // Validate + consume the CSRF state.
  const expected = await c.env.SESSIONS.get(`oauth:${state}`);
  if (expected !== provider) return c.json({ message: "invalid state" }, 400);
  await c.env.SESSIONS.delete(`oauth:${state}`);

  const profile = await exchange(c.env, provider, code);
  const user = await upsertUser(c.env, provider, profile);
  const cookie = await createSession(c.env, user.id);

  // Land back on the dashboard with the session token in the URL fragment (not
  // sent to servers). The SPA stores it and sends it as a Bearer header — robust
  // against cross-subdomain cookie blocking. The cookie is also set as a
  // same-origin fallback.
  const dash = (c.env.DASHBOARD_URL || "/").replace(/\/$/, "");
  return c.body(null, 302, {
    Location: dash + "/#s=" + encodeURIComponent(cookie),
    "Set-Cookie": sessionCookie(cookie),
  });
});

// Called via fetch from the dashboard; clears the session and returns JSON so
// the client can redirect itself.
app.post("/logout", (c) =>
  c.json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie }),
);

export default app;
