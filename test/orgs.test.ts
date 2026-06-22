// Control-plane authorization: org creation and creating repos under an org.
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { sha256, uuid } from "../src/lib/crypto";

const t = () => Math.floor(Date.now() / 1000);

async function seedUser(name: string): Promise<string> {
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
  return secret;
}

function post(path: string, token: string, body: unknown): Request {
  return new Request(`https://lockstep.test${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("org + repo control plane", () => {
  let alice: string, mallory: string;

  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    alice = await seedUser("alice");
    mallory = await seedUser("mallory");
  });

  it("creates an org and makes the caller its owner", async () => {
    const res = await app.fetch(post("/orgs", alice, { name: "Acme Games" }), env);
    expect(res.status).toBe(201);
    const { org } = await res.json<any>();
    expect(org.slug).toBe("acme-games");

    const list = await (await app.fetch(
      new Request("https://lockstep.test/orgs", { headers: { Authorization: `Bearer ${alice}` } }),
      env,
    )).json<any>();
    expect(list.orgs[0].role).toBe("owner");
    expect(list.orgs[0].seats).toBe(1);
  });

  it("a member can create a repo under the org", async () => {
    const { org } = await (await app.fetch(post("/orgs", alice, { name: "Acme" }), env)).json<any>();
    const res = await app.fetch(post(`/orgs/${org.id}/repos`, alice, { name: "Space Game" }), env);
    expect(res.status).toBe(201);
    expect((await res.json<any>()).repo.slug).toBe("space-game");
  });

  it("a non-member cannot create a repo under the org (403)", async () => {
    const { org } = await (await app.fetch(post("/orgs", alice, { name: "Acme" }), env)).json<any>();
    const res = await app.fetch(post(`/orgs/${org.id}/repos`, mallory, { name: "Sneaky" }), env);
    expect(res.status).toBe(403);
  });

  it("a non-member cannot read the org's storage config (403)", async () => {
    const { org } = await (await app.fetch(post("/orgs", alice, { name: "Acme" }), env)).json<any>();
    const res = await app.fetch(
      new Request(`https://lockstep.test/orgs/${org.id}/storage`, {
        headers: { Authorization: `Bearer ${mallory}` },
      }),
      env,
    );
    expect(res.status).toBe(403);
  });
});
