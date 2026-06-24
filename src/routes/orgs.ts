// Control-plane: orgs, seats, and storage connection. This is what the
// enterprise web dashboard drives. Requires a session/PAT (requireAuth).
//
// Storage secrets are validated (test connection), then encrypted at rest and
// NEVER returned to clients — the masked config is all the dashboard sees.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";
import { uuid, aesEncrypt } from "../lib/crypto";
import { testConnection, usage } from "../lib/storage";
import { orgRole } from "../lib/access";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", requireAuth());

const now = () => Math.floor(Date.now() / 1000);
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// --- Orgs ---

// Create an org; caller becomes its owner (and first seat).
app.post("/", async (c) => {
  const { userId } = c.get("identity");
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const name = body.name?.trim();
  if (!name) return c.json({ message: "name is required" }, 400);

  const org = { id: uuid(), name, slug: slugify(name) || uuid().slice(0, 8), created_at: now() };
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO orgs (id, name, slug, plan, created_at) VALUES (?, ?, ?, 'free', ?)",
      ).bind(org.id, org.name, org.slug, org.created_at),
      c.env.DB.prepare(
        "INSERT INTO org_members (org_id, user_id, role, seat_active, created_at) VALUES (?, ?, 'owner', 1, ?)",
      ).bind(org.id, userId, org.created_at),
    ]);
  } catch {
    return c.json({ message: "org slug already taken" }, 409);
  }
  return c.json({ org }, 201);
});

// List orgs the caller is a member of (with their role + seat count).
app.get("/", async (c) => {
  const { userId } = c.get("identity");
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.name, o.slug, o.plan, m.role,
            (SELECT COUNT(*) FROM org_members WHERE org_id = o.id AND seat_active = 1) AS seats
       FROM orgs o JOIN org_members m ON m.org_id = o.id
      WHERE m.user_id = ? ORDER BY o.created_at DESC`,
  )
    .bind(userId)
    .all();
  return c.json({ orgs: results });
});

// --- Storage connection (owner/admin only) ---

interface StorageBody {
  provider?: string;
  endpoint?: string;
  region?: string;
  bucket?: string;
  prefix?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

app.put("/:orgId/storage", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");

  const role = await orgRole(c.env, orgId, userId);
  if (role !== "owner" && role !== "admin") {
    return c.json({ message: "must be an org owner or admin" }, 403);
  }

  const b = await c.req.json<StorageBody>().catch(() => ({}) as StorageBody);
  const missing = ["provider", "endpoint", "bucket", "accessKeyId", "secretAccessKey"].filter(
    (k) => !b[k as keyof StorageBody],
  );
  if (missing.length) return c.json({ message: `missing: ${missing.join(", ")}` }, 400);

  const cfg = {
    endpoint: b.endpoint!,
    region: b.region || "auto",
    bucket: b.bucket!,
    accessKeyId: b.accessKeyId!,
    secretAccessKey: b.secretAccessKey!,
  };

  // Validate BEFORE persisting, so admins get an immediate pass/fail.
  const err = await testConnection(cfg);
  if (err) return c.json({ message: `connection test failed: ${err}` }, 400);

  const cipher = await aesEncrypt(c.env.LOCKSTEP_MASTER_KEY, cfg.secretAccessKey);
  await c.env.DB.prepare(
    `INSERT INTO org_storage
       (org_id, provider, endpoint, region, bucket, prefix, access_key_id, secret_cipher, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(org_id) DO UPDATE SET
       provider=excluded.provider, endpoint=excluded.endpoint, region=excluded.region,
       bucket=excluded.bucket, prefix=excluded.prefix, access_key_id=excluded.access_key_id,
       secret_cipher=excluded.secret_cipher, updated_at=excluded.updated_at`,
  )
    .bind(orgId, b.provider, cfg.endpoint, cfg.region, cfg.bucket, b.prefix ?? null,
      cfg.accessKeyId, cipher, now(), now())
    .run();

  await c.env.SESSIONS.delete(`usage:${orgId}`); // bust the usage cache

  return c.json({ ok: true, storage: maskedStorage(b) });
});

// Real usage read from the bucket (total bytes, object count, per-repo).
app.get("/:orgId/storage/usage", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!(await orgRole(c.env, orgId, userId))) return c.json({ message: "not a member" }, 403);
  return c.json(await usage(c.env, orgId));
});

// Return the org's storage config WITHOUT the secret.
app.get("/:orgId/storage", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!(await orgRole(c.env, orgId, userId))) return c.json({ message: "not a member" }, 403);

  const row = await c.env.DB.prepare(
    "SELECT provider, endpoint, region, bucket, prefix, access_key_id FROM org_storage WHERE org_id = ?",
  )
    .bind(orgId)
    .first<{
      provider: string;
      endpoint: string;
      region: string;
      bucket: string;
      prefix: string | null;
      access_key_id: string;
    }>();
  if (!row) return c.json({ storage: null });
  return c.json({
    storage: {
      provider: row.provider,
      endpoint: row.endpoint,
      region: row.region,
      bucket: row.bucket,
      prefix: row.prefix,
      accessKeyId: maskKey(row.access_key_id),
      secretAccessKey: "••••••••",
    },
  });
});

// --- Repos under an org (members only) ---

// Create a repo. Any active member may create; it belongs to the org, so all
// members get access via authorizeRepo on the data plane.
app.post("/:orgId/repos", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!(await orgRole(c.env, orgId, userId))) return c.json({ message: "not a member" }, 403);

  const body = await c.req
    .json<{ name?: string; slug?: string }>()
    .catch(() => ({}) as { name?: string; slug?: string });
  const slug = slugify(body.slug || body.name || "");
  if (!slug) return c.json({ message: "name or slug is required" }, 400);

  const repo = { id: uuid(), slug, owner_id: userId, org_id: orgId, created_at: now() };
  try {
    await c.env.DB.prepare(
      "INSERT INTO repos (id, slug, owner_id, org_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(repo.id, repo.slug, repo.owner_id, repo.org_id, repo.created_at)
      .run();
  } catch {
    return c.json({ message: "repo slug already taken" }, 409);
  }
  return c.json({ repo }, 201);
});

// List the org's repos.
app.get("/:orgId/repos", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!(await orgRole(c.env, orgId, userId))) return c.json({ message: "not a member" }, 403);

  const { results } = await c.env.DB.prepare(
    "SELECT id, slug, created_at FROM repos WHERE org_id = ? ORDER BY created_at DESC",
  )
    .bind(orgId)
    .all();
  return c.json({ repos: results });
});

// Recent activity. Dynamic actions (pushes, locks) come from the events table;
// control-plane milestones (org/repo/storage/token created) are derived from
// their own records so they don't need backfilling into the log.
app.get("/:orgId/activity", async (c) => {
  const id = c.get("identity");
  const userId = id.userId;
  const me = id.name || "You";
  const orgId = c.req.param("orgId");
  if (!(await orgRole(c.env, orgId, userId))) return c.json({ message: "not a member" }, 403);

  const events: Array<{ kind: string; what: string; who: string; when: number }> = [];

  const org = await c.env.DB.prepare("SELECT name, created_at FROM orgs WHERE id = ?")
    .bind(orgId)
    .first<{ name: string; created_at: number }>();
  if (org) events.push({ kind: "org", what: `created ${org.name}`, who: me, when: org.created_at });

  const st = await c.env.DB.prepare(
    "SELECT bucket, created_at, updated_at FROM org_storage WHERE org_id = ?",
  )
    .bind(orgId)
    .first<{ bucket: string; created_at: number; updated_at: number }>();
  if (st) events.push({ kind: "storage", what: `connected storage · ${st.bucket}`, who: me, when: st.updated_at || st.created_at });

  const repos = await c.env.DB.prepare(
    "SELECT slug, created_at FROM repos WHERE org_id = ? ORDER BY created_at DESC LIMIT 20",
  )
    .bind(orgId)
    .all<{ slug: string; created_at: number }>();
  for (const r of repos.results) events.push({ kind: "repo", what: `created repo ${r.slug}`, who: me, when: r.created_at });

  const tokens = await c.env.DB.prepare(
    "SELECT name, created_at FROM tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
  )
    .bind(userId)
    .all<{ name: string; created_at: number }>();
  for (const t of tokens.results) events.push({ kind: "token", what: `generated token · ${t.name}`, who: me, when: t.created_at });

  // Logged dynamic events (push/lock/unlock).
  const logged = await c.env.DB.prepare(
    "SELECT kind, detail, actor_name, created_at FROM events WHERE org_id = ? ORDER BY created_at DESC LIMIT 40",
  )
    .bind(orgId)
    .all<{ kind: string; detail: string | null; actor_name: string | null; created_at: number }>();
  for (const e of logged.results) {
    events.push({ kind: e.kind, what: e.detail || e.kind, who: e.actor_name || "Someone", when: e.created_at });
  }

  events.sort((a, b) => b.when - a.when);
  return c.json({ activity: events.slice(0, 25) });
});

function maskedStorage(b: StorageBody) {
  return {
    provider: b.provider,
    endpoint: b.endpoint,
    bucket: b.bucket,
    accessKeyId: maskKey(b.accessKeyId ?? ""),
    secretAccessKey: "••••••••",
  };
}

function maskKey(k: string): string {
  return k.length <= 6 ? "••••" : `${k.slice(0, 4)}…${k.slice(-2)}`;
}

export default app;
