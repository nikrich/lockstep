// Integration tests for locking + authorization against a real (in-memory) D1.
// Exercises the transactional UNIQUE(repo,path) guarantee AND the access model:
// org members can use a repo; non-members are rejected; only admins force-unlock.
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { sha256, uuid } from "../src/lib/crypto";

const t = () => Math.floor(Date.now() / 1000);

// Seed a user + a PAT; returns the token secret and the user id.
async function seedUser(name: string): Promise<{ secret: string; userId: string }> {
  const userId = uuid();
  await env.DB.prepare(
    `INSERT INTO users (id, provider, provider_id, email, name, avatar_url, created_at)
     VALUES (?, 'github', ?, ?, ?, NULL, ?)`,
  )
    .bind(userId, uuid(), name, name, t())
    .run();

  const secret = `lsk_test_${name}`;
  await env.DB.prepare(
    `INSERT INTO tokens (id, user_id, name, token_hash, scopes, created_at)
     VALUES (?, ?, 'test', ?, 'repo', ?)`,
  )
    .bind(uuid(), userId, await sha256(secret), t())
    .run();
  return { secret, userId };
}

async function seedOrg(slug: string): Promise<string> {
  const orgId = uuid();
  await env.DB.prepare(
    "INSERT INTO orgs (id, name, slug, plan, created_at) VALUES (?, ?, ?, 'free', ?)",
  )
    .bind(orgId, slug, slug, t())
    .run();
  return orgId;
}

async function addMember(orgId: string, userId: string, role: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO org_members (org_id, user_id, role, seat_active, created_at) VALUES (?, ?, ?, 1, ?)",
  )
    .bind(orgId, userId, role, t())
    .run();
}

async function seedRepo(slug: string, orgId: string, ownerId: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO repos (id, slug, owner_id, org_id, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(uuid(), slug, ownerId, orgId, t())
    .run();
}

function req(path: string, token: string, body?: unknown): Request {
  return new Request(`https://lockstep.test${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
}

async function json(res: Response): Promise<any> {
  return res.json();
}

describe("locks + authorization", () => {
  // jane=owner, bob=admin, dave=member; carol is NOT in the org.
  let jane: string, bob: string, dave: string, carol: string;

  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const j = await seedUser("jane");
    const b = await seedUser("bob");
    const d = await seedUser("dave");
    const c = await seedUser("carol");
    jane = j.secret;
    bob = b.secret;
    dave = d.secret;
    carol = c.secret;

    const orgId = await seedOrg("studio");
    await addMember(orgId, j.userId, "owner");
    await addMember(orgId, b.userId, "admin");
    await addMember(orgId, d.userId, "member");
    await seedRepo("demo", orgId, j.userId);
  });

  it("a member acquires a lock", async () => {
    const res = await app.fetch(req("/demo/locks", jane, { path: "Hero.uasset" }), env);
    expect(res.status).toBe(201);
    expect((await json(res)).lock.owner.name).toBe("jane");
  });

  it("rejects a second lock on the same path (409)", async () => {
    await app.fetch(req("/demo/locks", jane, { path: "Hero.uasset" }), env);
    const res = await app.fetch(req("/demo/locks", bob, { path: "Hero.uasset" }), env);
    expect(res.status).toBe(409);
    expect((await json(res)).lock.owner.name).toBe("jane");
  });

  it("verify splits ours and theirs", async () => {
    await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env);
    await app.fetch(req("/demo/locks", bob, { path: "b.uasset" }), env);
    const body = await json(await app.fetch(req("/demo/locks/verify", jane, {}), env));
    expect(body.ours).toHaveLength(1);
    expect(body.theirs).toHaveLength(1);
  });

  it("owner of a lock can unlock it", async () => {
    const { lock } = await json(await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env));
    const res = await app.fetch(req(`/demo/locks/${lock.id}/unlock`, jane, {}), env);
    expect(res.status).toBe(200);
  });

  it("a member cannot unlock another's lock without force (403)", async () => {
    const { lock } = await json(await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env));
    const res = await app.fetch(req(`/demo/locks/${lock.id}/unlock`, dave, {}), env);
    expect(res.status).toBe(403);
  });

  it("a plain member cannot force-unlock another's lock (403)", async () => {
    const { lock } = await json(await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env));
    const res = await app.fetch(req(`/demo/locks/${lock.id}/unlock`, dave, { force: true }), env);
    expect(res.status).toBe(403);
  });

  it("an admin can force-unlock another's lock (200)", async () => {
    const { lock } = await json(await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env));
    const res = await app.fetch(req(`/demo/locks/${lock.id}/unlock`, bob, { force: true }), env);
    expect(res.status).toBe(200);
  });

  it("a non-member is denied access to the repo (403)", async () => {
    const res = await app.fetch(req("/demo/locks", carol, { path: "a.uasset" }), env);
    expect(res.status).toBe(403);
  });

  it("an unknown repo is 404, not auto-created", async () => {
    const res = await app.fetch(req("/ghost-repo/locks", jane, { path: "a.uasset" }), env);
    expect(res.status).toBe(404);
  });

  it("rejects unauthenticated requests (401)", async () => {
    const res = await app.fetch(
      new Request("https://lockstep.test/demo/locks", {
        method: "POST",
        body: JSON.stringify({ path: "x.uasset" }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });
});
