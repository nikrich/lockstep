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
            git smart-HTTP + LFS batch + lock API
            (PAT auth; dashboard uses OAuth)
                ┌────────▼──────────────────────┐
                │ Coordination Worker (CF edge)  │
                │  • OAuth (GitHub/Google)       │
                │  • PAT auth                    │
                │  • LFS batch  ── presign ──┐   │
                │  • lock API ──┐            │   │
                └───────────────┼────────────┼───┘
                   D1 (consistent)│      KV (cache)
                   users/repos/   │      sessions +
                   tokens/LOCKS   │      token cache
                                  │            │
                         ┌────────▼────────────▼─┐
                         │ R2 bucket (BYO)        │  presigned PUT/GET
                         │ LFS blob CAS           │  0 bytes through Worker
                         └────────────────────────┘
```

## Locked-in decisions (2026-06-22)

| Decision | Choice | Rationale |
|---|---|---|
| VCS core | **Build on git + Git LFS protocol**, not a custom VCS | Reuse every git client + UE's existing git provider; differentiate on storage + locking + UX |
| Hosting | **You-hosted SaaS coordination** | Clean onboarding + per-seat billing; customer brings only a bucket |
| First client | **UE source-control provider plugin** (after CLI spike) | Strongest skillset; dogfood on a real 100 GB UE5 RPG |
| License | **BSL 1.1**, free under $1M revenue, → Apache 2.0 after 4 yr | Sustainable, indie-friendly; marketed as **fair-source**, never "open source" |
| Runtime | **All-in Cloudflare**: Workers + D1 + KV + R2 (TypeScript/Hono) | Near-zero hosting, edge-native, first-class D1/KV/R2 bindings |
| Auth | **OAuth (GitHub/Google)** for dashboard · **PATs** for git/CLI/UE/CI | GitHub/GitLab model; no per-seat Access cost; PAT = the git-native answer |
| Consistency split | **D1** = source of truth (users/repos/tokens/**locks**); **KV** = session/token cache | Locks need transactions (`UNIQUE(repo,path)`); KV's eventual consistency would allow double-locking |
| Storage | R2 via presigned URLs (S3 API, aws4fetch); customers BYO bucket | Zero egress; one S3 code path also covers B2/Wasabi/MinIO/S3 |

## Multi-tenant: control plane vs data plane

Lockstep is two surfaces over one Worker:

**Control plane — the enterprise web dashboard (humans, OAuth).** An org admin:
- creates an **org**, connects **storage once at the org level** (R2/S3 creds),
- creates repos, invites **members** (each = a billable **seat**), sets roles.

**Data plane — the API apps hit (machines, PAT/session tokens).** The desktop
app, git, git-lfs, and the UE plugin authenticate with a token and only ever
receive **short-lived presigned URLs** — never bucket credentials.

```
 Org admin ──OAuth──► Dashboard ──connect storage──► org_storage (D1)
                                                       secret AES-GCM encrypted
                                                       (master key = Worker secret)
 Seat user ──token──► Data-plane API ──resolve repo→org→decrypt──► presign ──► R2
                          (desktop app / git / UE plugin)          0 bytes via Worker
```

### The credential trust boundary (the critical invariant)

The org's bucket **secret never leaves the server.** It is encrypted at rest in
D1 (`org_storage.secret_cipher`, AES-256-GCM) and only the Worker — holding the
`LOCKSTEP_MASTER_KEY` — decrypts it to presign. A seat-holder can pull/push
assets but can never extract the bucket keys. That is what makes BYO-storage
safe to run as multi-tenant SaaS. Keys are further isolated **per repo** via a
key prefix (`<orgPrefix>/<repoSlug>/…`).

### Seats & desktop auth

- **Seat** = a row in `org_members` with `seat_active = 1`; the billing unit.
  Roles: `owner` / `admin` / `member`. Storage config is owner/admin-only.
- **Desktop app login**: OAuth via the browser (device/redirect flow) mints a
  session; for git operations the app uses a PAT stored in the OS credential
  helper. Same token model as git/CLI/CI — one mechanism for all machines.

*Status:* org CRUD, seat membership, encrypted storage-connect (with live
test-connection), and per-org/per-repo presign are **built and verified live**.
Still to build: invites/seat-billing flows, a create-repo-under-org endpoint
(repos currently auto-provision with no org for dev), and membership-scoped
authorization on every data-plane call.

## The moat: locking

### Why pessimistic locking (and why only for binaries)

The optimistic-vs-pessimistic debate only exists because most version control
assumes conflicts can be **merged**. For text/code that holds — git's 3-way
merge makes optimistic ("edit freely, resolve later") the right call.

Binary Unreal assets break the assumption: a `.uasset` **cannot be merged**, so
"resolve later" has only two outcomes — keep mine or keep theirs — and one
person's work is *destroyed*. For binaries the real choice is therefore "prevent
the conflict up front" vs "discover it after a day's work is lost." Pessimistic
locking is the only option that respects the artist's time. That's why every
serious game VCS (Perforce, Plastic, Diversion, Anchorpoint) offers it — it's
table stakes, not a differentiator.

So Lockstep is **hybrid**, applying locks *only where merge is impossible*:

| File type | Model | Mechanism |
|---|---|---|
| source/code (`.cpp/.h/.ini/.json`) | git optimistic merge | normal git |
| binary assets (`.uasset/.umap/.fbx/.psd`) | **pessimistic lock** | `lockable` in `.gitattributes` → read-only on disk until locked |

### Implementation

- **D1-backed lock table** keyed `UNIQUE(repo_id, path)` so acquisition is a
  single transactional INSERT — no race window (KV's eventual consistency could
  not guarantee this). *(Built — Phase 1.)*
- Speak the **existing Git LFS Locks API** so CLI/clients interoperate for free.
  *(Built.)*
- **Engine enforcement** (the magic, Phase 2): in the UE plugin,
  locked-by-someone-else assets are **read-only in-editor** with a "🔒 locked by
  X" badge; save is blocked unless you hold the lock; admins **force-release**.
- **Stale locks**: heartbeat + TTL auto-expiry; offline grace.

### Where we beat the incumbents (both stem from locking's weak spots)

1. **OFPA-native granularity.** UE5 World Partition / One File Per Actor saves
   each actor to its own file under `__ExternalActors__`, so two artists editing
   different parts of one level touch *different* files → *different* locks. This
   dissolves the classic "whole-level lock contention" pain. A locking system
   that *understands* the external-actor layout — surfacing locks at actor
   granularity, not just raw paths — is materially better than Perforce's
   generic file locking for modern UE5 projects. *(Planned.)*
2. **Soft / advisory locks.** An optional "warn, don't block" mode for
   high-trust teams who want git's freedom with a collision early-warning,
   instead of hard exclusive checkout. Addresses locking's offline/bottleneck
   weak spots without abandoning the safety net. *(Planned.)*

Locking's genuine costs we must manage: it needs connectivity to acquire (offline
grace + clear "you don't hold this" UI), and lock hygiene (TTL + force-unlock).

## Phases

| Phase | Deliverable | Proves |
|---|---|---|
| **0 — Spike** *(this repo)* | LFS Batch API → presigned URLs → R2 bucket | The cost story, end to end |
| 1 — Locks + git remote | Lock table + LFS Locks API; be the git smart-HTTP remote; auth | The moat works; self-contained |
| 2 — UE plugin | `ISourceControlProvider`: checkout/submit/lock/locked-by badge; **OFPA-aware** lock granularity | A real UE team can dogfood |
| 3 — GUI + teams | Tauri desktop app, projects, force-unlock, dashboard; **soft-lock mode** | Sellable to non-CLI artists |
| 4 — Polish / Unity | Onboarding, web dashboard, Unity package | Market expansion |

## Phase 0 deliberately omits

- Git smart-HTTP remote (use any throwaway git remote for now)
- Locking, auth, multi-tenancy (the `{repo}` path is captured but ignored)
- A `verify` action after upload (git-lfs treats a missing verify as success)

## Competitive landscape

- **Anchorpoint** — git-LFS + BYO S3 + GUI; closest comparable. Wedge vs them:
  engine-native locking + UE plugin depth + OFPA-aware lock granularity.
- **Diversion** — custom cloud VCS (not git). Heavier to build, less ecosystem.
- **Unity Version Control / Plastic**, **Perforce** — incumbents; expensive
  and/or not BYO-storage.

The defensible moat is **locking reliability + engine UX**, not the storage
abstraction (which is commodity).
