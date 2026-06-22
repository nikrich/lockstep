// Authorization for data-plane calls. Every git-lfs / lock request must prove
// the caller may touch the target repo. Two cases:
//   - org repo   → caller must hold an active seat (membership) in the org.
//   - personal   → repo with no org (dev/auto-provisioned): only its owner.
// Repos are NEVER auto-created on the data plane anymore — they must be created
// via the control plane (POST /orgs/:orgId/repos), so an unknown slug is 404.
import type { Context } from "hono";
import type { Env, Vars } from "./types";

export interface RepoRow {
  id: string;
  slug: string;
  owner_id: string;
  org_id: string | null;
}

export interface Authorized {
  repo: RepoRow;
  role: string | null; // org role for org repos; "owner" for a personal repo
}

export type AuthzResult =
  | { ok: true; value: Authorized }
  | { ok: false; status: 403 | 404; message: string };

/** The caller's active-seat role in an org, or null if not a member. */
export async function orgRole(
  env: Env,
  orgId: string,
  userId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND seat_active = 1",
  )
    .bind(orgId, userId)
    .first<{ role: string }>();
  return row?.role ?? null;
}

/** Resolve the repo from the :repo path param and authorize the caller. */
export async function authorizeRepo(
  c: Context<{ Bindings: Env; Variables: Vars }>,
): Promise<AuthzResult> {
  const slug = c.req.param("repo");
  if (!slug) return { ok: false, status: 404, message: "repo not found" };

  const repo = await c.env.DB.prepare(
    "SELECT id, slug, owner_id, org_id FROM repos WHERE slug = ?",
  )
    .bind(slug)
    .first<RepoRow>();
  if (!repo) return { ok: false, status: 404, message: "repo not found" };

  const { userId } = c.get("identity");

  if (repo.org_id) {
    const role = await orgRole(c.env, repo.org_id, userId);
    if (!role) {
      return { ok: false, status: 403, message: "not a member of this repo's org" };
    }
    return { ok: true, value: { repo, role } };
  }

  // Personal repo (no org): only the owner may access it.
  if (repo.owner_id !== userId) {
    return { ok: false, status: 403, message: "you do not have access to this repo" };
  }
  return { ok: true, value: { repo, role: "owner" } };
}
