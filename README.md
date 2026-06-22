<div align="center">

# 🔒 Lockstep

**Git-based source control for Unreal & Unity games — bring your own storage.**

Keep code in git. Stream giant binary assets to *your own* cloud bucket.
Lock files like Perforce. Pay pennies, not hundreds.

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-blue.svg)](LICENSE)
[![Fair-Source](https://img.shields.io/badge/fair--source-free%20under%20%241M-brightgreen.svg)](LICENSE-GRANT.md)
[![Status: Phase 0](https://img.shields.io/badge/status-alpha%20(Phase%200)-orange.svg)](#roadmap)
[![Built with Go](https://img.shields.io/badge/server-Go%201.22%2B-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
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
┌─────────────┐   ┌─────────────┐   ┌──────────────┐
│ Unreal      │   │ Unity       │   │ Desktop GUI  │   clients
│ plugin      │   │ package     │   │ (Tauri)      │
└──────┬──────┘   └──────┬──────┘   └──────┬───────┘
       └─────────────────┴─────────────────┘
                         │  git · LFS batch · file locks
                ┌────────▼─────────┐
                │ Coordination srv │   small + cheap: only pointers + locks
                │  (this repo, Go) │
                └────────┬─────────┘
                         │  presigned PUT/GET  (0 blob bytes through server)
                ┌────────▼─────────┐
                │  YOUR bucket     │   R2 · B2 · Wasabi · MinIO · S3
                └──────────────────┘
```

## Features

- 🪣 **Bring your own storage** — one S3-compatible code path covers
  Cloudflare R2, Backblaze B2, Wasabi, MinIO, and AWS S3.
- 🚫 **Zero egress, zero blob proxying** — bytes go client ↔ bucket directly.
- 🔒 **File locking** *(Phase 1)* — exclusive checkout for unmergeable
  `.uasset` / `.umap` / `.fbx`, enforced inside the editor.
- 🎮 **Native Unreal plugin** *(Phase 2)* — checkout, submit, and lock without
  leaving the editor.
- 🤝 **Fair-source** — free for indies and studios under **$1M/year**.

## Quickstart (Phase 0 spike)

> Phase 0 proves the cost story end-to-end: push a binary, watch it land in
> your bucket via a presigned URL, clone it back — server proxies **zero**
> blob bytes.

**Prerequisites:** [Go 1.22+](https://go.dev/dl/), `git`,
[`git-lfs`](https://git-lfs.com/), and a bucket on any S3-compatible provider.

```bash
git clone https://github.com/nikrich/lockstep.git
cd lockstep
cp .env.example .env          # edit with your bucket + keys
go mod tidy
go run ./server               # -> listening on :8080
```

Full end-to-end test (create a fake `.uasset`, push, clone, verify checksum) is
in [`docs/`](docs/architecture.md) and the run notes below the fold.

<details>
<summary>Load <code>.env</code> on PowerShell</summary>

```powershell
Get-Content .env | Where-Object { $_ -and $_ -notmatch '^\s*#' } |
  ForEach-Object { $k,$v = $_ -split '=',2; Set-Item "Env:$k" $v }
go run ./server
```
</details>

## Roadmap

| Phase | What | Status |
|---|---|---|
| **0** | Git LFS Batch API → presigned URLs → your bucket | ✅ done |
| **1** | File locking (LFS Locks API ✅) · be the git remote · auth | 🚧 in progress |
| **2** | Unreal `ISourceControlProvider` plugin | planned |
| **3** | Tauri desktop GUI · teams · force-unlock · dashboard | planned |
| **4** | Polish · onboarding · Unity package | planned |

## Repository layout

```
server/            Go coordination server
  storage/         S3-compatible adapter (R2 / B2 / Wasabi / MinIO / S3)
  lfs/             Git LFS Batch API handler
cli/               (Phase 1) thin git + lfs + lock wrapper
docs/              architecture & design
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
