// Dashboard OAuth login routes: /auth/:provider and /auth/:provider/callback.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { authorizeUrl, exchange, upsertUser, type Provider } from "../lib/oauth";
import { createSession, sessionCookie, clearSessionCookie } from "../lib/auth";
import { randomId } from "../lib/crypto";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const OAUTH_STATE_TTL = 600; // seconds

function isProvider(p: string): p is Provider {
  return p === "github" || p === "google";
}

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

  return c.body(null, 302, {
    Location: "/dashboard",
    "Set-Cookie": sessionCookie(cookie),
  });
});

app.post("/logout", (c) =>
  c.body(null, 302, { Location: "/", "Set-Cookie": clearSessionCookie }),
);

export default app;
