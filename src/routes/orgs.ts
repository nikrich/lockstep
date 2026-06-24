// Control-plane: orgs, seats, and storage connection. This is what the
// enterprise web dashboard drives. Requires a session/PAT (requireAuth).
//
// Storage secrets are validated (test connection), then encrypted at rest and
// NEVER returned to clients — the masked config is all the dashboard sees.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";
import { uuid, aesEncrypt, randomId, sha256 } from "../lib/crypto";
import { testConnection, usage } from "../lib/storage";
import { orgRole } from "../lib/access";
import { createCheckout, createPortalSession, billingConfigured } from "../lib/polar";

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

// --- Members, seats & invites ---

const isManager = (role: string | null) => role === "owner" || role === "admin";

// List members (joined with their profile) + pending invites + seat usage.
app.get("/:orgId/members", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  const role = await orgRole(c.env, orgId, userId);
  if (!role) return c.json({ message: "not a member" }, 403);

  const { results: members } = await c.env.DB.prepare(
    `SELECT m.user_id, m.role, m.seat_active, m.created_at,
            u.name, u.email, u.avatar_url
       FROM org_members m JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ? ORDER BY m.created_at ASC`,
  )
    .bind(orgId)
    .all();

  const { results: invites } = await c.env.DB.prepare(
    "SELECT id, email, role, created_at, expires_at FROM invites WHERE org_id = ? ORDER BY created_at DESC",
  )
    .bind(orgId)
    .all();

  return c.json({ members, invites, you: userId, canManage: isManager(role) });
});

// Invite a teammate (owner/admin). No email service yet → we return a shareable
// accept link carrying the raw token for the admin to send.
app.post("/:orgId/invites", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!isManager(await orgRole(c.env, orgId, userId))) {
    return c.json({ message: "must be an org owner or admin" }, 403);
  }

  const b = await c.req.json<{ email?: string; role?: string }>().catch(() => ({}) as { email?: string; role?: string });
  const email = b.email?.trim().toLowerCase();
  const inviteRole = b.role === "admin" ? "admin" : "member";
  if (!email || !/.+@.+\..+/.test(email)) return c.json({ message: "a valid email is required" }, 400);

  const already = await c.env.DB.prepare(
    "SELECT 1 FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND lower(u.email) = ?",
  )
    .bind(orgId, email)
    .first();
  if (already) return c.json({ message: "that person is already a member" }, 409);

  const raw = randomId(24);
  const id = uuid();
  const created = now();
  const expires = created + 14 * 24 * 3600; // 14 days
  try {
    await c.env.DB.prepare(
      `INSERT INTO invites (id, org_id, email, role, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, orgId, email, inviteRole, await sha256(raw), expires, created)
      .run();
  } catch {
    return c.json({ message: "an invite for that email already exists" }, 409);
  }
  return c.json(
    {
      invite: { id, email, role: inviteRole, created_at: created, expires_at: expires },
      acceptUrl: `${c.env.DASHBOARD_URL}/#invite=${raw}`,
    },
    201,
  );
});

// Revoke a pending invite (owner/admin).
app.delete("/:orgId/invites/:inviteId", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!isManager(await orgRole(c.env, orgId, userId))) {
    return c.json({ message: "must be an org owner or admin" }, 403);
  }
  await c.env.DB.prepare("DELETE FROM invites WHERE id = ? AND org_id = ?")
    .bind(c.req.param("inviteId"), orgId)
    .run();
  return c.body(null, 204);
});

// Accept an invite (any authenticated user). Matches the raw token, adds the
// caller as a member, and consumes the invite.
app.post("/accept-invite", async (c) => {
  const { userId } = c.get("identity");
  const b = await c.req.json<{ token?: string }>().catch(() => ({}) as { token?: string });
  if (!b.token) return c.json({ message: "token is required" }, 400);

  const invite = await c.env.DB.prepare(
    "SELECT id, org_id, role, expires_at FROM invites WHERE token_hash = ?",
  )
    .bind(await sha256(b.token))
    .first<{ id: string; org_id: string; role: string; expires_at: number }>();
  if (!invite) return c.json({ message: "invite not found or already used" }, 404);
  if (invite.expires_at < now()) {
    await c.env.DB.prepare("DELETE FROM invites WHERE id = ?").bind(invite.id).run();
    return c.json({ message: "invite expired" }, 410);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO org_members (org_id, user_id, role, seat_active, created_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(org_id, user_id) DO NOTHING`,
    ).bind(invite.org_id, userId, invite.role, now()),
    c.env.DB.prepare("DELETE FROM invites WHERE id = ?").bind(invite.id),
  ]);
  return c.json({ ok: true, orgId: invite.org_id });
});

// Change a member's role (owner/admin). Only an owner may grant owner; the last
// owner can't be demoted.
app.post("/:orgId/members/:memberId/role", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  const memberId = c.req.param("memberId");
  const myRole = await orgRole(c.env, orgId, userId);
  if (!isManager(myRole)) return c.json({ message: "must be an org owner or admin" }, 403);

  const b = await c.req.json<{ role?: string }>().catch(() => ({}) as { role?: string });
  const newRole = b.role;
  if (!newRole || !["owner", "admin", "member"].includes(newRole)) {
    return c.json({ message: "role must be owner, admin or member" }, 400);
  }
  if (newRole === "owner" && myRole !== "owner") {
    return c.json({ message: "only an owner can assign owner" }, 403);
  }

  const target = await c.env.DB.prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
    .bind(orgId, memberId)
    .first<{ role: string }>();
  if (!target) return c.json({ message: "member not found" }, 404);
  if (target.role === "owner" && newRole !== "owner" && (await ownerCount(c.env, orgId)) <= 1) {
    return c.json({ message: "cannot demote the last owner" }, 409);
  }

  await c.env.DB.prepare("UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?")
    .bind(newRole, orgId, memberId)
    .run();
  return c.json({ ok: true });
});

// Remove a member (owner/admin). Releases their locks + frees the seat; the
// last owner can't be removed.
app.delete("/:orgId/members/:memberId", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  const memberId = c.req.param("memberId");
  if (!isManager(await orgRole(c.env, orgId, userId))) {
    return c.json({ message: "must be an org owner or admin" }, 403);
  }

  const target = await c.env.DB.prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
    .bind(orgId, memberId)
    .first<{ role: string }>();
  if (!target) return c.json({ message: "member not found" }, 404);
  if (target.role === "owner" && (await ownerCount(c.env, orgId)) <= 1) {
    return c.json({ message: "cannot remove the last owner" }, 409);
  }

  await c.env.DB.prepare(
    "DELETE FROM locks WHERE owner_id = ? AND repo_id IN (SELECT id FROM repos WHERE org_id = ?)",
  )
    .bind(memberId, orgId)
    .run();
  await c.env.DB.prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?")
    .bind(orgId, memberId)
    .run();
  return c.body(null, 204);
});

async function ownerCount(env: Env, orgId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND role = 'owner'",
  )
    .bind(orgId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// --- Billing (Polar, Merchant of Record) ---

const SEAT_PRICE = 12;
const FREE_SEATS = 5;

async function activeSeatCount(env: Env, orgId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND seat_active = 1",
  )
    .bind(orgId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Current billing state for the org (plan, status, seats, renewal).
app.get("/:orgId/billing", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  const role = await orgRole(c.env, orgId, userId);
  if (!role) return c.json({ message: "not a member" }, 403);

  const org = await c.env.DB.prepare(
    "SELECT plan, subscription_status, seats_paid, current_period_end, polar_customer_id FROM orgs WHERE id = ?",
  )
    .bind(orgId)
    .first<{
      plan: string;
      subscription_status: string | null;
      seats_paid: number | null;
      current_period_end: number | null;
      polar_customer_id: string | null;
    }>();
  const seatsUsed = await activeSeatCount(c.env, orgId);

  return c.json({
    plan: org?.plan ?? "free",
    status: org?.subscription_status ?? "none",
    seatsPaid: org?.seats_paid ?? 0,
    seatsUsed,
    freeSeats: FREE_SEATS,
    seatPrice: SEAT_PRICE,
    currentPeriodEnd: org?.current_period_end ?? null,
    hasCustomer: !!org?.polar_customer_id,
    configured: billingConfigured(c.env),
    canManage: isManager(role),
  });
});

// Start a hosted Polar checkout for the org's current seat count.
app.post("/:orgId/billing/checkout", async (c) => {
  const id = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!isManager(await orgRole(c.env, orgId, id.userId))) {
    return c.json({ message: "must be an org owner or admin" }, 403);
  }
  const seats = Math.max(1, await activeSeatCount(c.env, orgId));
  try {
    const co = await createCheckout(c.env, {
      orgId,
      email: id.name.includes("@") ? id.name : null,
      seats,
      successUrl: `${c.env.DASHBOARD_URL}/#billing=success`,
    });
    return c.json({ url: co.url });
  } catch (e) {
    return c.json({ message: (e as Error).message }, 400);
  }
});

// Customer portal: manage card + invoices on Polar's side.
app.post("/:orgId/billing/portal", async (c) => {
  const { userId } = c.get("identity");
  const orgId = c.req.param("orgId");
  if (!isManager(await orgRole(c.env, orgId, userId))) {
    return c.json({ message: "must be an org owner or admin" }, 403);
  }
  const org = await c.env.DB.prepare("SELECT polar_customer_id FROM orgs WHERE id = ?")
    .bind(orgId)
    .first<{ polar_customer_id: string | null }>();
  if (!org?.polar_customer_id) return c.json({ message: "no active subscription yet" }, 400);
  try {
    return c.json({ url: await createPortalSession(c.env, org.polar_customer_id) });
  } catch (e) {
    return c.json({ message: (e as Error).message }, 400);
  }
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
