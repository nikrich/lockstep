// Repo resolution from the URL path. In dev, an unknown repo slug is
// auto-created on first use so you can `git push` without a dashboard round
// trip; in production this will be gated by membership/permissions (later).
import type { Context } from "hono";
import type { Env, Vars } from "./types";
import { uuid } from "./crypto";

export interface Repo {
  id: string;
  slug: string;
  owner_id: string;
}

export async function resolveRepo(
  c: Context<{ Bindings: Env; Variables: Vars }>,
): Promise<Repo | null> {
  const slug = c.req.param("repo");
  if (!slug) return null;

  const found = await c.env.DB.prepare("SELECT id, slug, owner_id FROM repos WHERE slug = ?")
    .bind(slug)
    .first<Repo>();
  if (found) return found;

  // Auto-provision for the authenticated caller (dev-friendly; tighten later).
  const id = c.get("identity");
  if (!id) return null;
  const repo: Repo = { id: uuid(), slug, owner_id: id.userId };
  await c.env.DB.prepare(
    "INSERT INTO repos (id, slug, owner_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(repo.id, repo.slug, repo.owner_id, Math.floor(Date.now() / 1000))
    .run();
  return repo;
}
