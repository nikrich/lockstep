# Authentication

Lockstep has two auth surfaces, each with the right mechanism:

| Surface | Who | Mechanism |
|---|---|---|
| **Dashboard** (create account, manage repos, mint tokens) | humans | **OAuth** — Sign in with GitHub or Google |
| **git · git-lfs · Unreal plugin · CI** | machines | **Personal Access Token** over HTTPS Basic |

This is the GitHub/GitLab model. OAuth exists only so a human can log in and
mint a PAT; everything that talks git uses the PAT.

> We deliberately do **not** use Cloudflare Access here. Access is per-seat
> Zero-Trust for protecting *your own* internal apps for *your own* workforce —
> wrong shape (and wrong cost) for authenticating *customers'* developers in a
> multi-tenant product.

## Where state lives

- **D1** (SQLite, strongly consistent) — source of truth: `users`, `repos`,
  `tokens` (SHA-256 hashes only), and `locks`. Locks live here because
  acquisition must be transactional; the `UNIQUE(repo_id, path)` constraint
  makes a lock either win or fail with no race window.
- **KV** (eventually consistent) — hot-path cache only: OAuth CSRF state,
  dashboard sessions, and a short-TTL token-hash → identity cache so the common
  request is a single KV read. Never locks.

## Dashboard login (OAuth)

1. Register OAuth apps (free):
   - **GitHub**: Settings → Developer settings → OAuth Apps. Callback URL
     `https://<your-worker>/auth/github/callback`.
   - **Google**: Cloud Console → Credentials → OAuth client (Web). Redirect URI
     `https://<your-worker>/auth/google/callback`.
2. Set secrets:
   ```bash
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put SESSION_SECRET     # random 32+ bytes
   ```
3. Flow: `GET /auth/github` → provider consent → `/auth/github/callback`
   verifies a KV-stored CSRF `state`, upserts the user, sets an HMAC-signed
   session cookie (session id stored in KV).

## Machine auth (Personal Access Tokens)

Mint a token from the dashboard (`POST /tokens`) — the plaintext is shown
**once**; only its SHA-256 hash is stored. Then use it as the git password:

```bash
# Configure once; git's credential helper caches it.
git config credential.https://<your-worker>.username lockstep
# When prompted for a password, paste the lsk_... token.

git push          # git-lfs sends the same Basic auth on batch + lock calls
git lfs lock  Content/Hero.uasset
```

For CI / the Unreal plugin, supply the token non-interactively via the
credential store or an `Authorization: Bearer lsk_...` header.

Revoke from the dashboard (`DELETE /tokens/:id`); the KV cache entry is evicted
immediately so the token stops working within seconds.

## Identity → lock owner

The authenticated identity's name (email, else `github`/`google` handle)
becomes the lock owner shown to teammates. In local dev with auth not yet
configured, seed a user + token in D1 (see `test/locks.test.ts` for the
pattern).
