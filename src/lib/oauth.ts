// OAuth 2.0 login for the dashboard — GitHub (primary, devs) and Google
// (secondary, artists). Hand-rolled: two fetches per provider, no SDK. The
// flow mints a Lockstep user + session; machines never use OAuth (they use
// PATs).
import type { Env, User } from "./types";
import { uuid } from "./crypto";

export type Provider = "github" | "google";

interface ProviderProfile {
  providerId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

function redirectUri(env: Env, provider: Provider): string {
  return `${env.BASE_URL}/auth/${provider}/callback`;
}

/** Build the provider's authorize URL to redirect the browser to. */
export function authorizeUrl(env: Env, provider: Provider, state: string): string {
  if (provider === "github") {
    const p = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri(env, "github"),
      scope: "read:user user:email",
      state,
    });
    return `https://github.com/login/oauth/authorize?${p}`;
  }
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(env, "google"),
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Exchange the callback code for the provider's normalized profile. */
export async function exchange(
  env: Env,
  provider: Provider,
  code: string,
): Promise<ProviderProfile> {
  return provider === "github"
    ? exchangeGitHub(env, code)
    : exchangeGoogle(env, code);
}

async function exchangeGitHub(env: Env, code: string): Promise<ProviderProfile> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri(env, "github"),
    }),
  });
  const { access_token } = await tokenRes.json<{ access_token: string }>();
  if (!access_token) throw new Error("github: no access_token");

  const headers = {
    Authorization: `Bearer ${access_token}`,
    "User-Agent": "Lockstep",
    Accept: "application/vnd.github+json",
  };
  const profile = await (await fetch("https://api.github.com/user", { headers })).json<{
    id: number;
    name: string | null;
    login: string;
    avatar_url: string;
  }>();

  // Primary email needs a separate call (and may be private).
  let email: string | null = null;
  const emails = await (
    await fetch("https://api.github.com/user/emails", { headers })
  ).json<Array<{ email: string; primary: boolean; verified: boolean }>>();
  if (Array.isArray(emails)) {
    email = emails.find((e) => e.primary && e.verified)?.email ?? null;
  }

  return {
    providerId: String(profile.id),
    email,
    name: profile.name ?? profile.login,
    avatarUrl: profile.avatar_url,
  };
}

async function exchangeGoogle(env: Env, code: string): Promise<ProviderProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(env, "google"),
    }),
  });
  const { access_token } = await tokenRes.json<{ access_token: string }>();
  if (!access_token) throw new Error("google: no access_token");

  const profile = await (
    await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    })
  ).json<{ sub: string; email: string; name: string; picture: string }>();

  return {
    providerId: profile.sub,
    email: profile.email ?? null,
    name: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
  };
}

/** Find-or-create the Lockstep user for a provider profile. */
export async function upsertUser(
  env: Env,
  provider: Provider,
  p: ProviderProfile,
): Promise<User> {
  const existing = await env.DB.prepare(
    "SELECT * FROM users WHERE provider = ? AND provider_id = ?",
  )
    .bind(provider, p.providerId)
    .first<User>();
  if (existing) return existing;

  const user: User = {
    id: uuid(),
    provider,
    provider_id: p.providerId,
    email: p.email,
    name: p.name,
    avatar_url: p.avatarUrl,
    created_at: Math.floor(Date.now() / 1000),
  };
  await env.DB.prepare(
    `INSERT INTO users (id, provider, provider_id, email, name, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      user.id,
      user.provider,
      user.provider_id,
      user.email,
      user.name,
      user.avatar_url,
      user.created_at,
    )
    .run();
  return user;
}
