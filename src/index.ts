// Lockstep coordination server — a Cloudflare Worker.
//
// Runtime: Workers + D1 (source of truth: users/repos/tokens/LOCKS) + KV
// (session/token cache) + R2 (blobs). Blob bytes never pass through the Worker:
// the LFS batch endpoint hands out presigned URLs to the bucket.
//
// Auth: OAuth (GitHub/Google) for the dashboard; Personal Access Tokens for
// git / git-lfs / the Unreal plugin / CI.
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Vars } from "./lib/types";
import authRoutes from "./routes/auth";
import tokenRoutes from "./routes/tokens";
import orgRoutes from "./routes/orgs";
import lfsRoutes from "./routes/lfs";
import lockRoutes from "./routes/locks";
import pushRoutes from "./routes/pushes";
import webhookRoutes from "./routes/webhooks";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// CORS so the web dashboard (app.lockstepcloud.com / localhost in dev) can call
// the API on api.lockstepcloud.com. git/git-lfs/UE clients are not browsers and
// are unaffected.
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin; // non-browser clients (no Origin header)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
      if (origin === "https://app.lockstepcloud.com") return origin;
      if (origin.endsWith(".lockstep-dashboard.pages.dev")) return origin;
      return undefined; // disallow other origins
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    credentials: true,
    maxAge: 86400,
  }),
);

app.get("/healthz", (c) => c.text("ok\n"));

// Dashboard auth + token management + org/seat/storage control plane.
app.route("/auth", authRoutes);
app.route("/tokens", tokenRoutes);
app.route("/orgs", orgRoutes);

// Inbound provider webhooks (signature-verified, not behind auth). Must be
// mounted before the greedy /:repo route so it isn't swallowed.
app.route("/webhooks", webhookRoutes);

// Per-repo git-lfs surface. git-lfs derives these from .lfsconfig's lfs.url:
//   {lfs.url}/objects/batch  and  {lfs.url}/locks...
app.route("/:repo", lfsRoutes);
app.route("/:repo/locks", lockRoutes);
app.route("/:repo/pushes", pushRoutes);

app.notFound((c) => c.json({ message: "not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ message: "internal error" }, 500);
});

export default app;
