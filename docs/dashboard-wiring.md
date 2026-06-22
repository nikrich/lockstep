# Web dashboard — wiring the prototype to the live API

The dashboard in `dashboard/` is the imported Claude Design prototype, running on
the dc-runtime with **mock data** (local React state). Every screen was designed
to map onto the live coordination server at `https://api.lockstepcloud.com`.
This doc is the plan to replace the mock state with real API calls.

Deployed prototype: https://lockstep-dashboard.pages.dev (→ will become
`app.lockstepcloud.com`).

## Screen → endpoint map

| Dashboard screen | Live endpoint(s) | Status |
|---|---|---|
| Sign in (GitHub / Google) | `GET /auth/github`, `GET /auth/google`, callbacks | endpoint ✅, **needs OAuth app secrets** |
| Org overview | `GET /orgs` (orgs + roles + seat counts) | ✅ built |
| **Storage connect** (provider, creds, **Test connection**) | `PUT /orgs/:id/storage` (validates before persist), `GET /orgs/:id/storage` (masked) | ✅ built + verified live |
| Repositories (list, create, clone URL) | `GET /orgs/:id/repos`, `POST /orgs/:id/repos` | ✅ built |
| Access Tokens (`lsk_`, scopes lock/read/write) | `GET /tokens`, `POST /tokens`, `DELETE /tokens/:id` | ✅ built (extend scopes) |
| Members & Seats (invite, roles, remove) | members list / invite / role-change | ⏳ **endpoints TODO** (`org_members` + `invites` tables exist) |
| Settings → org name/slug | org update | ⏳ TODO |
| Settings → presigned TTL + lock policy | per-org settings (TTL today is env-wide `LOCKSTEP_PRESIGN_TTL`) | ⏳ TODO (move to per-org) |
| Settings → profile (via GitHub) | from the OAuth session | endpoint ✅, needs OAuth |
| Billing | Stripe + plan/seat metering | ⏳ TODO (later) |

## Prerequisite: OAuth (blocks real login)

The dashboard's sign-in and "you @ via GitHub" profile need the OAuth apps wired:

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SESSION_SECRET   # random 32+ bytes
```

Callback URLs to register: `https://api.lockstepcloud.com/auth/github/callback`
and `.../auth/google/callback`. See `docs/auth.md`.

## Wiring approach

1. **Auth/session in the browser.** After OAuth, the dashboard holds the
   `ls_session` cookie (set by the API). Same-site fetches to
   `api.lockstepcloud.com` send it; configure CORS + `credentials: 'include'`.
   (Dashboard on `app.` + API on `api.` are same-site under `lockstepcloud.com`.)
2. **Replace mock state with a thin API client.** Add `dashboard/api.js` exposing
   `listOrgs()`, `getStorage(orgId)`, `putStorage(orgId, cfg)`, `listRepos`,
   `createRepo`, `listTokens`, `createToken`, etc. Swap each view's mock array
   for the corresponding call + loading/error states.
3. **Fill the TODO endpoints** (members/invites, org update, per-org TTL/lock
   policy, billing) on the Worker as each screen is wired.
4. **Productionize the front end.** The prototype renders via the in-browser
   dc-runtime + React. Before launch, port the dashboard component to a real
   build (Vite + React) for speed and maintainability — the design + logic carry
   over directly; only the bootstrapping changes.

## Notes

- Token scopes in the UI are `lock` / `read` / `write`; the `tokens.scopes`
  column currently defaults to `repo` — widen it to store the selected set.
- The create-repo dialog already shows the real clone URL shape
  `api.lockstepcloud.com/<org-slug>/<repo-slug>`.
- Storage connect is the security-critical screen and is the one already proven
  end-to-end (encrypted at rest, test-connection, masked read-back).
