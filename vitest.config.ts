import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  // Load migrations so tests can apply them to the isolated in-memory D1.
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      poolOptions: {
        workers: {
          miniflare: {
            compatibilityDate: "2024-12-05",
            compatibilityFlags: ["nodejs_compat"],
            d1Databases: ["DB"],
            kvNamespaces: ["SESSIONS"],
            r2Buckets: ["BLOBS"],
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
