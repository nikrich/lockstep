// Lockstep coordination server — a Cloudflare Worker.
//
// Runtime: Workers + D1 (source of truth: users/repos/tokens/LOCKS) + KV
// (session/token cache) + R2 (blobs). Blob bytes never pass through the Worker:
// the LFS batch endpoint hands out presigned URLs to the bucket.
//
// Auth: OAuth (GitHub/Google) for the dashboard; Personal Access Tokens for
// git / git-lfs / the Unreal plugin / CI.
import { Hono } from "hono";
import type { Env, Vars } from "./lib/types";
import authRoutes from "./routes/auth";
import tokenRoutes from "./routes/tokens";
import orgRoutes from "./routes/orgs";
import lfsRoutes from "./routes/lfs";
import lockRoutes from "./routes/locks";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.get("/healthz", (c) => c.text("ok\n"));

// Dashboard auth + token management + org/seat/storage control plane.
app.route("/auth", authRoutes);
app.route("/tokens", tokenRoutes);
app.route("/orgs", orgRoutes);

// Per-repo git-lfs surface. git-lfs derives these from .lfsconfig's lfs.url:
//   {lfs.url}/objects/batch  and  {lfs.url}/locks...
app.route("/:repo", lfsRoutes);
app.route("/:repo/locks", lockRoutes);

app.notFound((c) => c.json({ message: "not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ message: "internal error" }, 500);
});

export default app;
