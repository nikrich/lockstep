// Git LFS Batch API. Returns presigned S3 URLs (the "basic" transfer) so the
// client streams blob bytes directly to/from the bucket — never through the
// Worker. https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
//
// Credentials are resolved per-repo via its owning org's encrypted storage
// config (see lib/storage.ts), falling back to the env default bucket.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";
import { authorizeRepo } from "../lib/access";
import { resolveStorage, presign, exists } from "../lib/storage";
import { recordPush } from "../lib/events";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", requireAuth());

const PRESIGN_TTL = 900;

interface ObjectSpec {
  oid: string;
  size: number;
}

app.post("/objects/batch", async (c) => {
  const az = await authorizeRepo(c);
  if (!az.ok) return c.json({ message: az.message }, az.status);
  const repo = az.value.repo;

  const storage = await resolveStorage(c.env, repo.org_id, repo.slug);
  if (!storage) {
    return c.json({ message: "no storage configured for this repo's org" }, 503);
  }

  const body = await c.req.json<{ operation: string; objects: ObjectSpec[] }>();
  const op = body.operation;

  const objects = await Promise.all(
    (body.objects ?? []).map(async (o) => {
      if (op === "upload") {
        // Skip objects already in the bucket so re-runs/resumes are cheap and
        // idempotent (no upload action -> git-lfs treats it as done).
        if (await exists(storage, o.oid)) {
          return { oid: o.oid, size: o.size, authenticated: true };
        }
        const href = await presign(storage, o.oid, "PUT", PRESIGN_TTL);
        return {
          oid: o.oid,
          size: o.size,
          authenticated: true,
          actions: { upload: { href, expires_in: PRESIGN_TTL } },
        };
      }
      if (op === "download") {
        const href = await presign(storage, o.oid, "GET", PRESIGN_TTL);
        return {
          oid: o.oid,
          size: o.size,
          authenticated: true,
          actions: { download: { href, expires_in: PRESIGN_TTL } },
        };
      }
      return {
        oid: o.oid,
        size: o.size,
        error: { code: 422, message: `unsupported operation: ${op}` },
      };
    }),
  );

  // Log the push as activity (debounced across the burst of batch calls). Only
  // objects we handed an upload URL for are genuinely new bytes being pushed.
  if (op === "upload") {
    const fresh = objects.filter((o) => "actions" in o && (o as { actions?: { upload?: unknown } }).actions?.upload);
    if (fresh.length) {
      const bytes = fresh.reduce((n, o) => n + (o.size || 0), 0);
      await recordPush(c.env, repo, c.get("identity"), fresh.length, bytes);
    }
  }

  return c.json({ transfer: "basic", objects, hash_algo: "sha256" }, 200, {
    "Content-Type": "application/vnd.git-lfs+json",
  });
});

export default app;
