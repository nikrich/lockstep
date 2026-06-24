# Running Lockstep locally

The whole stack runs locally with no cloud auth — the dashboard talks to a local
Worker (Miniflare-simulated D1 / KV / R2) and authenticates with a seeded dev
Personal Access Token. Real OAuth login is deferred.

## One-time setup

```bash
npm install
# Secrets for local dev (the master key encrypts org storage secrets):
cp .dev.vars.example .dev.vars        # then set LOCKSTEP_MASTER_KEY to any
                                      # 32-byte base64 value; OAuth can stay blank
npm run migrate:local                 # apply D1 schema to the local database
npm run seed:local                    # seed a dev user + token + org + repos
```

The seed (`scripts/seed-local.sql`) creates:
- user `you@auroragames.dev`, org **Aurora Games** (`o_dev`), repos `aurora-rpg`
  + `aurora-tools`
- a dev token: **`lsk_dev_local_0001`** (the dashboard uses this automatically on
  localhost)

## Run it (two terminals)

```bash
npm run dev             # API  -> http://127.0.0.1:8787
npm run dev:dashboard   # UI   -> http://127.0.0.1:8788
```

Open **http://127.0.0.1:8788**, click "Continue with GitHub" (mock sign-in), and
the dashboard loads your real local data. Creating repos / tokens / connecting
storage persists to the local D1.

## How the wiring works

- `dashboard/api.js` detects `localhost` and calls the local Worker with the dev
  token; anywhere else it calls `https://api.lockstepcloud.com` with the session
  cookie (once OAuth is wired). No production secret is committed — the dev token
  only works against the local seed DB.
- `dashboard/assemble.mjs` rebuilds `dashboard/index.html` from the design export
  (`source.dc.html`), injects `api.js`, and patches the prototype to (1) load
  live data on mount and (2) persist the connect-storage / create-repo /
  create-token actions. Re-run with `npm run dashboard:build`.
- The Worker sends CORS headers for `localhost` / `app.lockstepcloud.com`.

## Notes

- **Connect storage** runs a real `PUT /orgs/:id/storage`, which validates the
  bucket before saving — so use real S3/R2 credentials when testing that flow
  (fake creds will fail the connection test, by design).
- Reset local data anytime: delete `.wrangler/state` then re-run
  `migrate:local` + `seed:local`.
- This is the throwaway dc-runtime prototype wired to the API. Before launch the
  dashboard should be ported to a real Vite + React build (see
  `docs/dashboard-wiring.md`); the design and API client carry straight over.
