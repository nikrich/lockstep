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

// Sharded key layout under the prefix: <prefix>/ab/cd/abcd...
function keyFor(prefix: string, oid: string): string {
  const shard = oid.length >= 4 ? `${oid.slice(0, 2)}/${oid.slice(2, 4)}/${oid}` : oid;
  return prefix ? `${prefix}/${shard}` : shard;
}

function joinPrefix(orgPrefix: string | null, repoSlug: string): string {
  return [orgPrefix, repoSlug].filter(Boolean).join("/");
}
