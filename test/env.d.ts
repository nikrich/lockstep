/// <reference types="@cloudflare/vitest-pool-workers" />

// Extends the Workers test env with the migrations bundle injected by
// vitest.config.ts (used by applyD1Migrations).
declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    SESSIONS: KVNamespace;
    BLOBS: R2Bucket;
    TEST_MIGRATIONS: D1Migration[];
  }
}
