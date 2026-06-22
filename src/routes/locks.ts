// Git LFS File Locking API, backed by D1 for transactional correctness.
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/locking.md
//
// The moat: binary assets can't be merged, so a path may have at most one
// active lock. The UNIQUE(repo_id, path) constraint makes acquisition a single
// INSERT that either wins or fails — no race window.
//
// Every handler authorizes the caller against the repo first (authorizeRepo):
// org repos require an active seat; personal repos require ownership.
import { Hono } from "hono";
import type { Env, Lock, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";
import { uuid } from "../lib/crypto";
import { authorizeRepo } from "../lib/access";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", requireAuth());

const toJSON = (l: Lock) => ({
  id: l.id,
  path: l.path,
  locked_at: new Date(l.locked_at * 1000).toISOString(),
  owner: { name: l.owner_name },
});

// POST /:repo/locks — acquire.
app.post("/", async (c) => {
  const az = await authorizeRepo(c);
  if (!az.ok) return c.json({ message: az.message }, az.status);
  const repo = az.value.repo;
  const id = c.get("identity");

  const body = await c.req
    .json<{ path?: string; ref?: { name?: string } }>()
    .catch(() => ({}) as { path?: string; ref?: { name?: string } });
  if (!body.path) return c.json({ message: "path is required" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT * FROM locks WHERE repo_id = ? AND path = ?",
  )
    .bind(repo.id, body.path)
    .first<Lock>();
  if (existing) {
    return c.json({ lock: toJSON(existing), message: "already locked" }, 409);
  }

  const lock: Lock = {
    id: uuid(),
    repo_id: repo.id,
    path: body.path,
    ref: body.ref?.name ?? null,
    owner_id: id.userId,
    owner_name: id.name,
    locked_at: Math.floor(Date.now() / 1000),
  };
  try {
    await c.env.DB.prepare(
      `INSERT INTO locks (id, repo_id, path, ref, owner_id, owner_name, locked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(lock.id, lock.repo_id, lock.path, lock.ref, lock.owner_id, lock.owner_name, lock.locked_at)
      .run();
  } catch {
    const winner = await c.env.DB.prepare(
      "SELECT * FROM locks WHERE repo_id = ? AND path = ?",
    )
      .bind(repo.id, body.path)
      .first<Lock>();
    return c.json({ lock: winner ? toJSON(winner) : undefined, message: "already locked" }, 409);
  }
  return c.json({ lock: toJSON(lock) }, 201);
});

// GET /:repo/locks — list (optional ?path= & ?id= filters).
app.get("/", async (c) => {
  const az = await authorizeRepo(c);
  if (!az.ok) return c.json({ message: az.message }, az.status);
  const repo = az.value.repo;

  const path = c.req.query("path");
  const id = c.req.query("id");
  let sql = "SELECT * FROM locks WHERE repo_id = ?";
  const binds: unknown[] = [repo.id];
  if (path) (sql += " AND path = ?"), binds.push(path);
  if (id) (sql += " AND id = ?"), binds.push(id);
  sql += " ORDER BY locked_at ASC";

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<Lock>();
  return c.json({ locks: results.map(toJSON), next_cursor: "" });
});

// POST /:repo/locks/verify — split into the caller's locks vs everyone else's.
app.post("/verify", async (c) => {
  const az = await authorizeRepo(c);
  if (!az.ok) return c.json({ message: az.message }, az.status);
  const repo = az.value.repo;
  const me = c.get("identity").userId;

  const { results } = await c.env.DB.prepare("SELECT * FROM locks WHERE repo_id = ?")
    .bind(repo.id)
    .all<Lock>();
  return c.json({
    ours: results.filter((l) => l.owner_id === me).map(toJSON),
    theirs: results.filter((l) => l.owner_id !== me).map(toJSON),
    next_cursor: "",
  });
});

// POST /:repo/locks/:id/unlock — own lock anytime; someone else's only with
// force AND an admin/owner role (a plain member cannot steal a lock).
app.post("/:id/unlock", async (c) => {
  const az = await authorizeRepo(c);
  if (!az.ok) return c.json({ message: az.message }, az.status);
  const repo = az.value.repo;
  const role = az.value.role;
  const me = c.get("identity").userId;
  const lockId = c.req.param("id");

  const body = await c.req
    .json<{ force?: boolean }>()
    .catch(() => ({}) as { force?: boolean });
  const lock = await c.env.DB.prepare(
    "SELECT * FROM locks WHERE id = ? AND repo_id = ?",
  )
    .bind(lockId, repo.id)
    .first<Lock>();
  if (!lock) return c.json({ message: "lock not found" }, 404);

  if (lock.owner_id !== me) {
    if (!body.force) {
      return c.json({ message: "lock owned by another user; retry with force" }, 403);
    }
    if (role !== "owner" && role !== "admin") {
      return c.json({ message: "force-unlocking another user's lock requires an admin" }, 403);
    }
  }
  await c.env.DB.prepare("DELETE FROM locks WHERE id = ?").bind(lockId).run();
  return c.json({ lock: toJSON(lock) });
});

export default app;
