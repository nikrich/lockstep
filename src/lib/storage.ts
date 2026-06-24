// Storage resolution + presigning. Given a repo, resolve the org's bucket
// credentials (decrypting the stored secret) and presign S3 URLs with aws4fetch.
// Blob bytes never pass through the Worker — only these short-lived URLs do.
import { AwsClient } from "aws4fetch";
import type { Env } from "./types";
import { aesDecrypt } from "./crypto";

export interface ResolvedStorage {
  client: AwsClient;
  base: string; // S3 endpoint, e.g. https://<acct>.r2.cloudflarestorage.com
  bucket: string;
  prefix: string; // key prefix (org prefix + repo slug → per-repo isolation)
}

interface OrgStorageRow {
  provider: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string | null;
  access_key_id: string;
  secret_cipher: string;
}

/**
 * Resolve storage for a repo. Prefers the owning org's configured bucket
 * (per-tenant, encrypted creds); falls back to the env default bucket (used to
 * prove the thesis and for single-tenant/dev).
 */
export async function resolveStorage(
  env: Env,
  orgId: string | null,
  repoSlug: string,
): Promise<ResolvedStorage | null> {
  if (orgId) {
    const row = await env.DB.prepare("SELECT * FROM org_storage WHERE org_id = ?")
      .bind(orgId)
      .first<OrgStorageRow>();
    if (row) {
      const secret = await aesDecrypt(env.LOCKSTEP_MASTER_KEY, row.secret_cipher);
      return {
        client: new AwsClient({
          accessKeyId: row.access_key_id,
          secretAccessKey: secret,
          service: "s3",
          region: row.region || "auto",
        }),
        base: row.endpoint.replace(/\/$/, ""),
        bucket: row.bucket,
        prefix: joinPrefix(row.prefix, repoSlug),
      };
    }
  }

  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    return {
      client: new AwsClient({
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        service: "s3",
        region: "auto",
      }),
      base: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      bucket: env.R2_BUCKET,
      prefix: repoSlug,
    };
  }
  return null;
}

/** Presign a per-object URL for GET or PUT. */
export async function presign(
  s: ResolvedStorage,
  oid: string,
  method: "GET" | "PUT",
  ttl = 900,
): Promise<string> {
  const url = `${s.base}/${s.bucket}/${keyFor(s.prefix, oid)}?X-Amz-Expires=${ttl}`;
  const signed = await s.client.sign(url, { method, aws: { signQuery: true } });
  return signed.url;
}

/**
 * Validate credentials by attempting to list one object. Returns null on
 * success, or an error message — used by the "test connection" step before we
 * persist an org's storage config.
 */
export async function testConnection(cfg: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<string | null> {
  try {
    const client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: "s3",
      region: cfg.region || "auto",
    });
    const url = `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}?list-type=2&max-keys=1`;
    const res = await client.fetch(url, { method: "GET" });
    if (res.ok) return null;
    return `storage responded ${res.status}: ${(await res.text()).slice(0, 200)}`;
  } catch (e) {
    return `could not reach storage: ${(e as Error).message}`;
  }
}

/**
 * Real storage usage for an org, read from its bucket: total bytes, object
 * count, and bytes-per-repo (the first path segment under the org prefix).
 * Note: blobs are content-addressed (sha256), so logical asset folders are not
 * recoverable here — only totals and per-repo aggregates are real. Capped at
 * 5 pages (~5000 objects) to bound cost; `truncated` flags when it stops early.
 */
export async function usage(
  env: Env,
  orgId: string,
): Promise<{ connected: boolean; totalBytes: number; objects: number; byRepo: Array<{ repo: string; bytes: number }>; truncated?: boolean }> {
  // Listing a large bucket is several S3 calls, so cache the result briefly.
  const cacheKey = `usage:${orgId}`;
  const cachedRaw = await env.SESSIONS.get(cacheKey);
  if (cachedRaw) {
    try { return JSON.parse(cachedRaw); } catch { /* recompute below */ }
  }

  const row = await env.DB.prepare("SELECT * FROM org_storage WHERE org_id = ?")
    .bind(orgId)
    .first<OrgStorageRow>();
  if (!row) return { connected: false, totalBytes: 0, objects: 0, byRepo: [] };

  const secret = await aesDecrypt(env.LOCKSTEP_MASTER_KEY, row.secret_cipher);
  const client = new AwsClient({
    accessKeyId: row.access_key_id,
    secretAccessKey: secret,
    service: "s3",
    region: row.region || "auto",
  });
  const base = row.endpoint.replace(/\/$/, "");
  const prefix = row.prefix ? row.prefix.replace(/\/$/, "") + "/" : "";

  let token: string | undefined;
  let total = 0;
  let count = 0;
  let pages = 0;
  const byRepo: Record<string, number> = {};
  const contents = /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g;

  do {
    const u = new URL(`${base}/${row.bucket}`);
    u.searchParams.set("list-type", "2");
    if (prefix) u.searchParams.set("prefix", prefix);
    u.searchParams.set("max-keys", "1000");
    if (token) u.searchParams.set("continuation-token", token);

    const res = await client.fetch(u.toString(), { method: "GET" });
    if (!res.ok) break;
    const xml = await res.text();

    let m: RegExpExecArray | null;
    while ((m = contents.exec(xml)) !== null) {
      const key = m[1] ?? "";
      const size = parseInt(m[2] ?? "0", 10) || 0;
      total += size;
      count++;
      const rest = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
      const repo = rest.split("/")[0] || "(root)";
      byRepo[repo] = (byRepo[repo] || 0) + size;
    }
    contents.lastIndex = 0;
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    token = next ? next[1] : undefined;
    pages++;
  } while (token && pages < 60);

  const result = {
    connected: true,
    totalBytes: total,
    objects: count,
    byRepo: Object.entries(byRepo)
      .map(([repo, bytes]) => ({ repo, bytes }))
      .sort((a, b) => b.bytes - a.bytes),
    truncated: !!token,
  };
  // Cache for 60s so dashboard loads aren't re-listing the bucket every time.
  await env.SESSIONS.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 });
  return result;
}

// Sharded key layout under the prefix: <prefix>/ab/cd/abcd...
function keyFor(prefix: string, oid: string): string {
  const shard = oid.length >= 4 ? `${oid.slice(0, 2)}/${oid.slice(2, 4)}/${oid}` : oid;
  return prefix ? `${prefix}/${shard}` : shard;
}

function joinPrefix(orgPrefix: string | null, repoSlug: string): string {
  return [orgPrefix, repoSlug].filter(Boolean).join("/");
}
