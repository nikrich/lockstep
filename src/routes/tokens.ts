// Personal Access Token management (requires a dashboard session). Users mint
// PATs here and paste them into git / the UE plugin / CI.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";
import { newToken, uuid } from "../lib/crypto";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", requireAuth());

// List the caller's tokens (metadata only — secrets are never retrievable).
app.get("/", async (c) => {
  const { userId } = c.get("identity");
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, scopes, created_at, last_used_at, expires_at
       FROM tokens WHERE user_id = ? ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all();
  return c.json({ tokens: results });
});

// Create a token. The plaintext secret is returned ONCE, here, and never again.
app.post("/", async (c) => {
  const { userId } = c.get("identity");
  const body = await c.req
    .json<{ name?: string; expires_at?: number }>()
    .catch(() => ({}) as { name?: string; expires_at?: number });
  const name = body.name?.trim() || "token";

  const { secret, hash } = await newToken();
  const id = uuid();
  await c.env.DB.prepare(
    `INSERT INTO tokens (id, user_id, name, token_hash, scopes, created_at, expires_at)
     VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
  )
    .bind(id, userId, name, hash, Math.floor(Date.now() / 1000), body.expires_at ?? null)
    .run();

  return c.json(
    {
      id,
      name,
      token: secret, // shown once
      hint: "Save this now — it won't be shown again. Use it as the password for git over HTTPS.",
    },
    201,
  );
});

// Revoke a token. Also evict any KV cache entry so it stops working promptly.
app.delete("/:id", async (c) => {
  const { userId } = c.get("identity");
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT token_hash FROM tokens WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ token_hash: string }>();
  if (!row) return c.json({ message: "not found" }, 404);

  await c.env.DB.prepare("DELETE FROM tokens WHERE id = ?").bind(id).run();
  await c.env.SESSIONS.delete(`tok:${row.token_hash}`);
  return c.json({ revoked: id });
});

export default app;
