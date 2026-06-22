// Git LFS Batch API. Returns presigned R2 URLs (the "basic" transfer) so the
// client streams blob bytes directly to/from the bucket — never through the
// Worker. https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
//
// Bytes are signed with aws4fetch against R2's S3 endpoint, so this works
// equally for a customer's bring-your-own R2/S3 bucket.
import { Hono } from "hono";
import { AwsClient } from "aws4fetch";
import type { Env, Vars } from "../lib/types";
import { requireAuth } from "../lib/auth";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", requireAuth());

const PRESIGN_TTL = 900; // seconds

interface ObjectSpec {
  oid: string;
  size: number;
}

// Sharded key layout: ab/cd/abcd...
function keyFor(oid: string): string {
  return oid.length >= 4 ? `${oid.slice(0, 2)}/${oid.slice(2, 4)}/${oid}` : oid;
}

function s3(env: Env): { client: AwsClient; base: string; bucket: string } | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    return null;
  }
  return {
    client: new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    }),
    base: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    bucket: env.R2_BUCKET,
  };
}

async function presign(env: Env, oid: string, method: "GET" | "PUT"): Promise<string> {
  const cfg = s3(env);
  const url = cfg
    ? `${cfg.base}/${cfg.bucket}/${keyFor(oid)}?X-Amz-Expires=${PRESIGN_TTL}`
    : "";
  if (!cfg) {
    // Fall back to the bound R2 bucket proxied through a Worker route. The
    // S3-API presign path is preferred (zero proxying); this keeps dev simple.
    return `${env.BASE_URL}/r2/${keyFor(oid)}`;
  }
  const signed = await cfg.client.sign(url, { method, aws: { signQuery: true } });
  return signed.url;
}

app.post("/objects/batch", async (c) => {
  const body = await c.req.json<{ operation: string; objects: ObjectSpec[] }>();
  const op = body.operation;

  const objects = await Promise.all(
    (body.objects ?? []).map(async (o) => {
      if (op === "upload") {
        return {
          oid: o.oid,
          size: o.size,
          authenticated: true,
          actions: {
            upload: { href: await presign(c.env, o.oid, "PUT"), expires_in: PRESIGN_TTL },
          },
        };
      }
      if (op === "download") {
        return {
          oid: o.oid,
          size: o.size,
          authenticated: true,
          actions: {
            download: { href: await presign(c.env, o.oid, "GET"), expires_in: PRESIGN_TTL },
          },
        };
      }
      return {
        oid: o.oid,
        size: o.size,
        error: { code: 422, message: `unsupported operation: ${op}` },
      };
    }),
  );

  return c.json({ transfer: "basic", objects, hash_algo: "sha256" }, 200, {
    "Content-Type": "application/vnd.git-lfs+json",
  });
});

export default app;
