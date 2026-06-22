# Lockstep — Architecture

> Git for code + content-addressed binary blobs in **your** bucket +
> Perforce-grade locking + native engine plugins. The server stores pointers
> and locks (pennies). The customer's bucket stores the bytes (pennies).
> Nobody pays egress.

## Why this exists

Git LFS hosting (GitHub etc.) bills storage on the **entire version history**
— and LFS keeps a **full copy of every version** of every binary — plus
**egress on every clone/pull** at ~$0.09–0.10/GB. For a 100 GB game with an
active team that runs to **hundreds to thousands of dollars/month**.

Bring-your-own object storage on Cloudflare R2 or Backblaze B2 (free egress
via the Bandwidth Alliance) is **~$2–25/month, flat** for the same data —
typically **10–40× cheaper**, and the gap widens as history grows because the
customer controls retention/GC.

## Component map

```
┌─────────────┐   ┌─────────────┐   ┌──────────────┐
│ UE plugin   │   │ Unity pkg   │   │ Desktop GUI  │   clients
│ (C++ ISCP)  │   │ (C#) [later]│   │ (Tauri)[later│
└──────┬──────┘   └──────┬──────┘   └──────┬───────┘
       └─────────────────┴─────────────────┘
                         │  git smart-HTTP + LFS batch + lock API
                ┌────────▼─────────┐
                │ Coordination srv │  YOU host (SaaS). Go + Postgres.
                │  • auth / teams  │  Tiny: only pointers + locks + refs.
                │  • git remote    │
                │  • LFS batch  ◄──┼── implemented in Phase 0
                │  • LOCK table    │
                └────────┬─────────┘
                         │  presigned PUT/GET URLs (0 blob bytes through server)
                ┌────────▼─────────┐
                │ Customer bucket  │  BYO: R2 / B2 / Wasabi / MinIO / S3
                │  (LFS blob CAS)  │
                └──────────────────┘
```

## Locked-in decisions (2026-06-22)

| Decision | Choice | Rationale |
|---|---|---|
| VCS core | **Build on git + Git LFS protocol**, not a custom VCS | Reuse every git client + UE's existing git provider; differentiate on storage + locking + UX |
| Hosting | **You-hosted SaaS coordination** | Clean onboarding + per-seat billing; customer brings only a bucket |
| First client | **UE source-control provider plugin** (after CLI spike) | Strongest skillset; dogfood on a real 100 GB UE5 RPG |
| License | **BSL 1.1**, free under $1M revenue, → Apache 2.0 after 4 yr | Sustainable, indie-friendly; marketed as **fair-source**, never "open source" |
| Server stack | **Go** (axum/Rust later for shared client core) | Fastest path to a working LFS server; single static binary to deploy |
| Storage | One **S3-compatible** code path | Covers R2 / B2 / Wasabi / MinIO / S3 |

## The moat: locking

Binary `.uasset`/`.umap`/`.fbx` files **cannot be merged**. Two simultaneous
editors = destroyed work. This is *why* Perforce owns game dev. Lockstep's
plan:

- **Server-authoritative lock table**: `(repo, branch?, path, owner,
  acquired_at, heartbeat_at)`.
- Speak the **existing Git LFS Locks API** so CLI/clients interoperate for
  free.
- **Engine enforcement** (the magic): in the UE plugin, locked-by-someone-else
  assets are **read-only in-editor** with a "🔒 locked by X" badge; save is
  blocked unless you hold the lock; admins can **force-release**.
- **Stale locks**: heartbeat + TTL auto-expiry; offline grace.

## Phases

| Phase | Deliverable | Proves |
|---|---|---|
| **0 — Spike** *(this repo)* | LFS Batch API → presigned URLs → R2 bucket | The cost story, end to end |
| 1 — Locks + git remote | Lock table + LFS Locks API; be the git smart-HTTP remote; auth | The moat works; self-contained |
| 2 — UE plugin | `ISourceControlProvider`: checkout/submit/lock/locked-by badge | A real UE team can dogfood |
| 3 — GUI + teams | Tauri desktop app, projects, force-unlock, dashboard | Sellable to non-CLI artists |
| 4 — Polish / Unity | Onboarding, web dashboard, Unity package | Market expansion |

## Phase 0 deliberately omits

- Git smart-HTTP remote (use any throwaway git remote for now)
- Locking, auth, multi-tenancy (the `{repo}` path is captured but ignored)
- A `verify` action after upload (git-lfs treats a missing verify as success)

## Competitive landscape

- **Anchorpoint** — git-LFS + BYO S3 + GUI; closest comparable. Wedge vs them:
  engine-native locking + UE plugin depth.
- **Diversion** — custom cloud VCS (not git). Heavier to build, less ecosystem.
- **Unity Version Control / Plastic**, **Perforce** — incumbents; expensive
  and/or not BYO-storage.

The defensible moat is **locking reliability + engine UX**, not the storage
abstraction (which is commodity).
