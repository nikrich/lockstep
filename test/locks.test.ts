// Integration tests for the locking API against a real (in-memory) D1 via the
// Workers vitest pool. These exercise the transactional UNIQUE(repo,path)
// guarantee that is the whole point of using D1 over KV for locks.
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { sha256, uuid } from "../src/lib/crypto";

// Seed a user + a PAT so requests authenticate as that user.
async function seedUser(name: string): Promise<string> {
  const userId = uuid();
  await env.DB.prepare(
    `INSERT INTO users (id, provider, provider_id, email, name, avatar_url, created_at)
     VALUES (?, 'github', ?, ?, ?, NULL, ?)`,
  )
    .bind(userId, uuid(), name, name, Math.floor(Date.now() / 1000))
    .run();

  const secret = `lsk_test_${name}`;
  await env.DB.prepare(
    `INSERT INTO tokens (id, user_id, name, token_hash, scopes, created_at)
     VALUES (?, ?, 'test', ?, 'repo', ?)`,
  )
    .bind(uuid(), userId, await sha256(secret), Math.floor(Date.now() / 1000))
    .run();
  return secret;
}

function req(path: string, token: string, body?: unknown): Request {
  return new Request(`https://lockstep.test${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : "{}",
  });
}

describe("locks API", () => {
  let jane: string;
  let bob: string;

  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    jane = await seedUser("jane");
    bob = await seedUser("bob");
  });

  it("acquires a lock", async () => {
    const res = await app.fetch(req("/demo/locks", jane, { path: "Hero.uasset" }), env);
    expect(res.status).toBe(201);
    const { lock } = await res.json<any>();
    expect(lock.path).toBe("Hero.uasset");
    expect(lock.owner.name).toBe("jane");
  });

  it("rejects a second lock on the same path with 409", async () => {
    await app.fetch(req("/demo/locks", jane, { path: "Hero.uasset" }), env);
    const res = await app.fetch(req("/demo/locks", bob, { path: "Hero.uasset" }), env);
    expect(res.status).toBe(409);
    const { lock } = await res.json<any>();
    expect(lock.owner.name).toBe("jane"); // reports the real holder
  });

  it("verify splits ours and theirs", async () => {
    await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env);
    await app.fetch(req("/demo/locks", bob, { path: "b.uasset" }), env);
    const res = await app.fetch(req("/demo/locks/verify", jane, {}), env);
    const body = await res.json<any>();
    expect(body.ours).toHaveLength(1);
    expect(body.theirs).toHaveLength(1);
  });

  it("forbids unlocking another user's lock without force", async () => {
    const create = await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env);
    const { lock } = await create.json<any>();
    const res = await app.fetch(req(`/demo/locks/${lock.id}/unlock`, bob, {}), env);
    expect(res.status).toBe(403);
  });

  it("allows force-unlock of another user's lock", async () => {
    const create = await app.fetch(req("/demo/locks", jane, { path: "a.uasset" }), env);
    const { lock } = await create.json<any>();
    const res = await app.fetch(req(`/demo/locks/${lock.id}/unlock`, bob, { force: true }), env);
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated requests", async () => {
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
