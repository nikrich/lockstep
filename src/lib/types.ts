// Worker bindings (see wrangler.toml) and shared domain types.

export interface Env {
  // Bindings
  DB: D1Database;
  SESSIONS: KVNamespace;
  BLOBS: R2Bucket;

  // Vars
  BASE_URL: string;

  // Secrets
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  // 32-byte base64 key for envelope-encrypting org storage secrets.
  LOCKSTEP_MASTER_KEY: string;

  // Bring-your-own R2 (S3 API) for presigned blob transfer.
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
}

export interface User {
  id: string;
  provider: string;
  provider_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: number;
}

export interface Lock {
  id: string;
  repo_id: string;
  path: string;
  ref: string | null;
  owner_id: string;
  owner_name: string;
  locked_at: number;
}

// The authenticated caller attached to a request by middleware.
export interface Identity {
  userId: string;
  // Canonical name shown as the lock owner (email, else github/google handle).
  name: string;
  // 'session' = browser dashboard; 'token' = PAT (git/CLI/UE/CI).
  via: "session" | "token";
}

// Hono context variables.
export type Vars = { identity: Identity };
