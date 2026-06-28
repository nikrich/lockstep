// POST /:repo/pushes — the client reports a successful submit (git push) so it
// lands in the org activity feed. Binary blob transfers are logged separately by
// the LFS batch endpoint (recordPush); this covers code-only pushes that never
// touch LFS, which otherwise left no trace in activity.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";
import { authorizeRepo } from "../lib/access";
import { logEvent } from "../lib/events";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", requireAuth());

app.post("/", async (c) => {
  const az = await authorizeRepo(c);
  if (!az.ok) return c.json({ message: az.message }, az.status);
  const repo = az.value.repo;
  const id = c.get("identity");

  const body = await c.req
    .json<{ files?: number; commit?: string }>()
    .catch(() => ({}) as { files?: number; commit?: string });
  const files = Math.max(0, Math.floor(Number(body.files) || 0));
  const commit = body.commit ? ` · ${String(body.commit).slice(0, 10)}` : "";

  if (repo.org_id) {
    await logEvent(c.env, {
      orgId: repo.org_id,
      repoId: repo.id,
      actorId: id.userId,
      actorName: id.name,
      kind: "push",
      detail: `pushed ${files} ${files === 1 ? "file" : "files"} to ${repo.slug}${commit}`,
    });
  }
  return c.json({ ok: true });
});

export default app;
