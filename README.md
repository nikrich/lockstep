<div align="center">

# 🔒 Lockstep

**Git-based source control for Unreal & Unity games — bring your own storage.**

Keep code in git. Stream giant binary assets to *your own* cloud bucket.
Lock files like Perforce. Pay pennies, not hundreds.

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-blue.svg)](LICENSE)
[![Fair-Source](https://img.shields.io/badge/fair--source-free%20under%20%241M-brightgreen.svg)](LICENSE-GRANT.md)
[![Status: Phase 1](https://img.shields.io/badge/status-alpha%20(Phase%201)-orange.svg)](#roadmap)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020.svg?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Engines: Unreal · Unity](https://img.shields.io/badge/engines-Unreal%20%C2%B7%20Unity-5c5c5c.svg)](#)

</div>

---

## The problem

Hosted Git LFS (GitHub and friends) bills you for the **entire version
history** — and LFS keeps a **full copy of every version** of every binary —
*plus* **egress on every clone and pull** at ~$0.09–0.10/GB. For a real
100 GB game with an active team, that runs into **hundreds of dollars a
month**, climbing forever as history grows.

Meanwhile, object storage with free egress (Cloudflare R2, Backblaze B2 via
the Bandwidth Alliance) costs **a few dollars a month, flat** — for the *same*
data.

## The fix

Lockstep keeps your **code and small files in git**, and streams your **big
binary assets straight into a bucket you own**. The coordination server only
ever brokers short-lived presigned URLs — **blob bytes never pass through it**
— so there's nothing to meter and no egress to pay. On top of that it adds the
one thing git can't do and game teams can't live without: **Perforce-grade
file locking**.

### What it costs (100 GB game, active team)

| | Storage/mo | Bandwidth/mo | **Total/mo** |
|---|---|---|---|
| **GitHub Git LFS** | $39–149 | $39–199 | **$78 – $350+** |
| **Lockstep + Cloudflare R2** | $6 | **$0** | **~$6** |
| **Lockstep + Backblaze B2 + CDN** | $2.40 | **$0** | **~$2** |

*Typically **10–40× cheaper**, and the gap widens with history because **you**
own the bucket and control retention. Full breakdown in
[`docs/architecture.md`](docs/architecture.md).*

## How it works

```
   clients (git · git-lfs · UE plugin · Tauri GUI)
        │  PAT auth (dashboard login via OAuth)
        ▼
┌─────────────────────────────────────────────┐
│ Coordination Worker  (Cloudflare edge, TS)   │
│  OAuth · PATs · LFS batch · lock API         │
└───┬───────────────┬───────────────┬──────────┘
    │ D1            │ KV            │ presign
    │ consistent    │ cache         ▼
    │ users/repos/  │ sessions   ┌──────────────┐
    │ tokens/LOCKS  │ + tokens   │ R2 (your     │
    └───────────────┘            │ bucket) blobs│  0 bytes via Worker
                                 └──────────────┘
```

## Features

- 🪣 **Bring your own storage** — presigned URLs to your own R2 bucket (one
  S3-compatible path also covers B2 / Wasabi / MinIO / S3).
- 🚫 **Zero egress, zero blob proxying** — bytes go client ↔ bucket directly.
- 🔒 **File locking** — exclusive checkout for unmergeable `.uasset` / `.umap`
  / `.fbx`, transactionally correct (D1 `UNIQUE(repo,path)`, no race window).
- 🔑 **Dev-friendly auth** — OAuth (GitHub/Google) for the dashboard, Personal
  Access Tokens for git / CI / the engine plugin.
- ⚡ **Runs on Cloudflare** — Workers + D1 + KV + R2; near-zero hosting cost.
- 🎮 **Native Unreal plugin** *(Phase 2)* — checkout, submit, lock in-editor.
- 🤝 **Fair-source** — free for indies and studios under **$1M/year**.

## Quickstart (local dev)

**Prerequisites:** [Node 20+](https://nodejs.org), and a Cloudflare account for
deploy (local dev runs fully offline via Miniflare).

```bash
git clone https://github.com/nikrich/lockstep.git
cd lockstep
npm install
npm run migrate:local      # apply D1 schema to the local dev database
npm run dev                # wrangler dev -> http://localhost:8787
npm test                   # run the Worker integration tests (vitest)
```

Deploy: create the resources (`wrangler d1 create lockstep`,
`wrangler kv namespace create SESSIONS`, `wrangler r2 bucket create
lockstep-blobs`), paste the ids into `wrangler.toml`, set secrets
(`wrangler secret put ...` — see [`docs/auth.md`](docs/auth.md)), then
`npm run deploy`.

See [`docs/auth.md`](docs/auth.md) for OAuth + token setup and
[`docs/architecture.md`](docs/architecture.md) for the full design.

## Roadmap

| Phase | What | Status |
|---|---|---|
| **0** | Git LFS Batch API → presigned URLs → your bucket | ✅ done |
| **1** | File locking ✅ · OAuth + PATs ✅ · be the git remote | 🚧 in progress |
| **2** | Unreal `ISourceControlProvider` plugin | planned |
| **3** | Tauri desktop GUI · teams · force-unlock · dashboard | planned |
| **4** | Polish · onboarding · Unity package | planned |

## Repository layout

```
src/
  index.ts         Worker entrypoint (Hono routes)
  routes/          auth (OAuth), tokens (PATs), lfs (batch), locks
  lib/             types, crypto, auth middleware, oauth, repo resolution
migrations/        D1 schema (users, repos, tokens, locks)
test/              Worker integration tests (vitest pool)
cli/               (later) thin git + lfs + lock wrapper
docs/              architecture, auth & design
examples/          .gitattributes / .lfsconfig for your UE project
```

## Licensing

Lockstep is **fair-source**, not OSI "open source." The source is public and
you may read, fork, modify, and self-host it for non-production use. **Production
use is free** for any organization under **USD $1M/year** revenue; above that,
a commercial license applies. Every released version **converts to Apache 2.0
four years after release**.

See [`LICENSE`](LICENSE) (Business Source License 1.1) and
[`LICENSE-GRANT.md`](LICENSE-GRANT.md). Commercial inquiries:
**jannik811@gmail.com**.

## Contributing

Non-production use — evaluation, development, and contributions — is open to
everyone. Read [`docs/architecture.md`](docs/architecture.md) before proposing
larger changes, and open an issue to discuss direction. PRs welcome.

<div align="center">
<sub>Built for game teams who'd rather own their data than rent it back by the gigabyte.</sub>
</div>
