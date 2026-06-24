// Append-only activity log. Logging must never break the request it describes,
// so failures are swallowed.
import type { Env } from "./types";

export interface EventInput {
  orgId: string;
  repoId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  kind: "push" | "lock" | "unlock" | "force_unlock";
  detail?: string | null;
}

export async function logEvent(env: Env, e: EventInput): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO events (id, org_id, repo_id, actor_id, actor_name, kind, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        e.orgId,
        e.repoId ?? null,
        e.actorId ?? null,
        e.actorName ?? null,
        e.kind,
        e.detail ?? null,
        Math.floor(Date.now() / 1000),
      )
      .run();
  } catch {
    // never let activity logging break the underlying operation
  }
}

// A single `git push` triggers many LFS batch calls. Rather than logging one
// event per batch, we debounce per repo+actor (KV, 3-min window) and keep a
// running blob/byte total on ONE event, so the feed reads "pushed N blobs (X)".
export async function recordPush(
  env: Env,
  repo: { id: string; slug: string; org_id: string | null },
  actor: { userId: string; name?: string | null },
  blobs: number,
  bytes: number,
): Promise<void> {
  if (!repo.org_id || blobs <= 0) return;
  try {
    const key = `pushagg:${repo.id}:${actor.userId}`;
    const ts = Math.floor(Date.now() / 1000);
    const prev = await env.SESSIONS.get(key);
    if (prev) {
      const a = JSON.parse(prev) as { eventId: string; blobs: number; bytes: number };
      a.blobs += blobs;
      a.bytes += bytes;
      await env.DB.prepare("UPDATE events SET detail = ?, created_at = ? WHERE id = ?")
        .bind(pushDetail(repo.slug, a.blobs, a.bytes), ts, a.eventId)
        .run();
      await env.SESSIONS.put(key, JSON.stringify(a), { expirationTtl: 180 });
    } else {
      const eventId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO events (id, org_id, repo_id, actor_id, actor_name, kind, detail, created_at)
         VALUES (?, ?, ?, ?, ?, 'push', ?, ?)`,
      )
        .bind(eventId, repo.org_id, repo.id, actor.userId, actor.name ?? null, pushDetail(repo.slug, blobs, bytes), ts)
        .run();
      await env.SESSIONS.put(key, JSON.stringify({ eventId, blobs, bytes }), { expirationTtl: 180 });
    }
  } catch {
    // logging is best-effort
  }
}

function pushDetail(slug: string, blobs: number, bytes: number): string {
  return `pushed ${blobs.toLocaleString()} ${blobs === 1 ? "blob" : "blobs"} (${fmtBytes(bytes)}) to ${slug}`;
}

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}
