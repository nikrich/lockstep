// Git LFS Batch API. Returns presigned S3 URLs (the "basic" transfer) so the
// client streams blob bytes directly to/from the bucket — never through the
// Worker. https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
//
// Credentials are resolved per-repo via its owning org's encrypted storage
// config (see lib/storage.ts), falling back to the env default bucket.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";
import { resolveRepo } from "../lib/repo";
import { resolveStorage, presign } from "../lib/storage";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", requireAuth());

const PRESIGN_TTL = 900;

interface ObjectSpec {
  oid: string;
  size: number;
}

app.post("/objects/batch", async (c) => {
  const repo = await resolveRepo(c);
  if (!repo) return c.json({ message: "repo not found" }, 404);

  const storage = await resolveStorage(c.env, repo.org_id, repo.slug);
  if (!storage) {
    return c.json({ message: "no storage configured for this repo's org" }, 503);
  }

  const body = await c.req.json<{ operation: string; objects: ObjectSpec[] }>();
  const op = body.operation;

  const objects = await Promise.all(
    (body.objects ?? []).map(async (o) => {
      if (op === "upload" || op === "download") {
        const method = op === "upload" ? "PUT" : "GET";
        const href = await presign(storage, o.oid, method, PRESIGN_TTL);
        return {
          oid: o.oid,
          size: o.size,
          authenticated: true,
          actions: { [op]: { href, expires_in: PRESIGN_TTL } },
        };
      }
      return {
        oid: o.oid,
        size: o.size,
        error: { code: 422, message: `unsupported operation: ${op}` },
      };
    }),
  );

  return c.json({ transfer: "basic", objects, hash_algo: "sha256" }, 200, {
    "Content-Type": "application/vnd.git-lfs+json",
  });
});

export default app;
