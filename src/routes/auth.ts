// Dashboard OAuth login routes: /auth/:provider and /auth/:provider/callback.
//
// Plus the engine/CLI loopback sign-in flow (/auth/plugin/*): a native app opens
// /auth/plugin/start in the system browser, the user logs in with the same OAuth,
// the server mints a PAT and hands it back to the app's localhost listener via a
// one-time code. No copy-pasting tokens. See docs/auth.md.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { authorizeUrl, exchange, upsertUser, type Provider } from "../lib/oauth";
import { createSession, sessionCookie, clearSessionCookie, requireAuth } from "../lib/auth";
import { randomId, newToken, uuid } from "../lib/crypto";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const OAUTH_STATE_TTL = 600; // seconds
const PAIR_TTL = 600; // plugin sign-in pairing lifetime
const CODE_TTL = 120; // one-time code -> token exchange window

function isProvider(p: string): p is Provider {
  return p === "github" || p === "google";
}

// Only ever redirect a minted token to a loopback address the native app owns.
function isLoopbackRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost");
  } catch {
    return false;
  }
}

// The CSRF-state value stored in KV during OAuth. For the dashboard it's just the
// provider string (back-compat); for the plugin flow it's JSON carrying the pairing.
function parseOAuthState(raw: string): { provider: string; pairId?: string } {
  if (raw.startsWith("{")) {
    try {
      const o = JSON.parse(raw) as { provider: string; pairId?: string };
      return { provider: o.provider, pairId: o.pairId };
    } catch {
      /* fall through */
    }
  }
  return { provider: raw };
}

// Sanitize a client-supplied app name before echoing it into HTML / storing it
// as a token label. Keep it short and free of markup.
function cleanClientName(raw: string | undefined | null): string {
  const name = (raw || "").replace(/[<>"'&]/g, "").trim().slice(0, 48);
  return name || "this device";
}

// Minimal provider chooser shown in the browser for the native sign-in flow.
// `client` is the calling app's name (e.g. "Lockstep Desktop", "Unreal plugin").
function chooserPage(pairId: string, client: string): string {
  const gh = `/auth/plugin/go/github?pair=${encodeURIComponent(pairId)}`;
  const goog = `/auth/plugin/go/google?pair=${encodeURIComponent(pairId)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in to Lockstep</title>
<style>body{margin:0;background:#0f141a;color:#eef2f6;font:400 16px/1.5 system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#161d25;border:1px solid #232c36;border-radius:14px;padding:36px 40px;max-width:380px;text-align:center}
h1{font-size:20px;margin:0 0 6px}p{color:#bcc6d1;font-size:14px;margin:0 0 24px}
a{display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;margin:10px 0}
.gh{background:#eef2f6;color:#161d25}.goog{background:#1b232c;color:#eef2f6;border:1px solid #36434f}</style></head>
<body><div class="card"><h1>Sign in to Lockstep</h1><p>Authorize <b>${client}</b> on this machine.</p>
<a class="gh" href="${gh}">Continue with GitHub</a>
<a class="goog" href="${goog}">Continue with Google</a></div></body></html>`;
}

const closeTabHtml = (ok: boolean) =>
  `<!doctype html><meta charset="utf-8"><title>Lockstep</title>
<body style="margin:0;background:#0f141a;color:#eef2f6;font:400 16px/1.6 system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="text-align:center"><div style="font-size:22px;margin-bottom:8px">${ok ? "✓ Signed in to Lockstep" : "Sign-in failed"}</div>
<div style="color:#bcc6d1;font-size:14px">${ok ? "You can close this tab and return to the app." : "Please restart sign-in from the app."}</div></div></body>`;

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

// ---- Plugin / CLI loopback sign-in ----------------------------------------

// Step 1: the native app opens this in the browser with its localhost callback.
// We stash the pairing and show a provider chooser.
app.get("/plugin/start", async (c) => {
  const redirectUri = c.req.query("redirect_uri") || "";
  const state = c.req.query("state") || "";
  const client = cleanClientName(c.req.query("client"));
  if (!isLoopbackRedirect(redirectUri)) {
    return c.text("invalid redirect_uri (must be a loopback address)", 400);
  }
  const pairId = randomId(16);
  await c.env.SESSIONS.put(
    `pair:${pairId}`,
    JSON.stringify({ redirectUri, pluginState: state, client }),
    { expirationTtl: PAIR_TTL },
  );
  return c.html(chooserPage(pairId, client));
});

// Step 2: chosen provider -> begin OAuth, carrying the pairing through `state`.
app.get("/plugin/go/:provider", async (c) => {
  const provider = c.req.param("provider");
  if (!isProvider(provider)) return c.json({ message: "unknown provider" }, 404);
  const pairId = c.req.query("pair") || "";
  const pair = await c.env.SESSIONS.get(`pair:${pairId}`);
  if (!pair) return c.text("sign-in expired — restart it from the editor", 400);

  const state = randomId(16);
  await c.env.SESSIONS.put(`oauth:${state}`, JSON.stringify({ provider, pairId }), {
    expirationTtl: OAUTH_STATE_TTL,
  });
  return c.redirect(authorizeUrl(c.env, provider, state));
});

// Step 4 (after OAuth callback redirects here): the app exchanges its one-time
// code for the minted PAT. Unauthenticated, but the code is single-use + short-lived
// and was only ever delivered to the app's own loopback listener.
app.post("/plugin/exchange", async (c) => {
  const body = await c.req.json<{ code?: string }>().catch(() => ({}) as { code?: string });
  if (!body.code) return c.json({ message: "missing code" }, 400);
  const raw = await c.env.SESSIONS.get(`pcode:${body.code}`);
  if (!raw) return c.json({ message: "invalid or expired code" }, 400);
  await c.env.SESSIONS.delete(`pcode:${body.code}`);
  const { token, name } = JSON.parse(raw) as { token: string; name: string };
  return c.json({ token, name });
});

// ---- Dashboard OAuth -------------------------------------------------------

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

// Provider redirects back here with ?code & ?state. Shared by the dashboard and
// plugin flows; the stashed state tells us which.
app.get("/:provider/callback", async (c) => {
  const provider = c.req.param("provider");
  if (!isProvider(provider)) return c.json({ message: "unknown provider" }, 404);

  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.json({ message: "missing code/state" }, 400);

  // Validate + consume the CSRF state.
  const raw = await c.env.SESSIONS.get(`oauth:${state}`);
  if (!raw) return c.json({ message: "invalid state" }, 400);
  const parsed = parseOAuthState(raw);
  if (parsed.provider !== provider) return c.json({ message: "invalid state" }, 400);
  await c.env.SESSIONS.delete(`oauth:${state}`);

  const profile = await exchange(c.env, provider, code);
  const user = await upsertUser(c.env, provider, profile);

  // --- Plugin flow: mint a PAT and hand it to the app's loopback listener. ---
  if (parsed.pairId) {
    const pairRaw = await c.env.SESSIONS.get(`pair:${parsed.pairId}`);
    if (!pairRaw) return c.html(closeTabHtml(false), 400);
    const pair = JSON.parse(pairRaw) as { redirectUri: string; pluginState: string; client?: string };
    await c.env.SESSIONS.delete(`pair:${parsed.pairId}`);

    const tokenName = cleanClientName(pair.client);
    const { secret, hash } = await newToken();
    await c.env.DB.prepare(
      `INSERT INTO tokens (id, user_id, name, token_hash, scopes, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(uuid(), user.id, tokenName, hash, "read,write,lock", Math.floor(Date.now() / 1000), null)
      .run();

    const oneTimeCode = randomId(24);
    await c.env.SESSIONS.put(
      `pcode:${oneTimeCode}`,
      JSON.stringify({ token: secret, name: tokenName }),
      { expirationTtl: CODE_TTL },
    );

    if (!isLoopbackRedirect(pair.redirectUri)) return c.html(closeTabHtml(false), 400);
    const sep = pair.redirectUri.includes("?") ? "&" : "?";
    const loc = `${pair.redirectUri}${sep}code=${encodeURIComponent(oneTimeCode)}&state=${encodeURIComponent(pair.pluginState)}`;
    return c.redirect(loc, 302);
  }

  // --- Dashboard flow (unchanged): mint a session, land back on the SPA. ---
  const cookie = await createSession(c.env, user.id);
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
