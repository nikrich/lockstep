# Claude Design Prompt — Lockstep Desktop App

> Paste the block below into Claude (design/artifact mode) to generate the desktop GUI.
> It is grounded in `docs/architecture.md` (Phase 3) and the existing Lockstep design
> tokens in `dashboard/lockstep/tokens/`.

---

Design the **Lockstep desktop app** — a native source-control GUI for game teams
(Unreal / Unity), the human-facing client for a git + Git-LFS coordination service
with Perforce-grade file locking. Think "GitHub Desktop meets Perforce P4V, but
calm, modern, and built for artists who fear the command line." It ships as a Tauri
app (web UI in a native shell), so design responsive desktop layouts at ~1280×800
and up, with a resizable left sidebar.

## What the product does (so the UI tells the truth)
- Keeps **code + small files in git**; streams **giant binary assets** (`.uasset`,
  `.umap`, `.fbx`, `.psd`) straight to the team's **own cloud bucket** via short-lived
  presigned URLs. Bytes never pass through Lockstep's server.
- Adds the one thing git lacks: **pessimistic file locking** for unmergeable binaries.
  A locked binary is **read-only on disk** until you hold the lock. Source/code stays
  normal optimistic git — never locked.
- Auth: the user signs in via **OAuth in the browser** (GitHub/Google); git operations
  use a **Personal Access Token** stored in the OS keychain. The app belongs to an
  **org**; each member is a billable **seat** with a role (owner / admin / member).

## Core screens to design
1. **Repository view (the home screen).** A working-copy file/changes browser:
   - Left sidebar: list of repos/projects, sync status, current branch.
   - Center: the changeset — files grouped by **Changed / Locked by me / Locked by
     others / Synced / Conflict**. Each row shows path, file-type icon, size, and a
     **lock state badge** with the holder's name + avatar when locked by someone else.
   - Primary actions per file and in bulk: **Lock**, **Unlock**, **Submit (commit +
     push)**, **Sync (pull)**, **Discard**. Locked-by-other rows are visibly disabled
     for editing with a "🔒 locked by Maya" treatment.
   - A prominent **Sync** / **Submit** action bar with progress (uploads stream to the
     bucket — show per-file transfer progress, not a spinner).
2. **Commit / Submit panel.** Message field, list of included assets, lock-release
   toggle ("release locks on submit"), and a clear before/after of what gets pushed to
   git vs streamed to the bucket.
3. **Locks overview.** A team-wide table of all active locks across the repo: path,
   holder, age, and (for admins) a **Force-release** action with confirmation. Show
   stale/expiring locks (TTL) distinctly. Include the planned **OFPA / per-actor**
   granularity idea: locks surfaced at *actor* level for World Partition levels, not
   just raw file paths.
4. **Onboarding / connect.** First-run: sign in (browser OAuth), pick org, clone or
   open a local project, and a reassuring "your bucket, your bytes" storage summary.
5. **Settings.** Account/seat, PAT management, storage info (read-only for members),
   and an optional **soft-lock mode** toggle ("warn, don't block" advisory locking for
   high-trust teams).

## Visual language (match the existing Lockstep brand)
- **Dark-first**, calm and dense-but-legible — a professional tool, not a toy.
- **Brand accent: amber** `#ffb224` — used specifically as the **lock** color, so amber
  reads as "locked" throughout. Use it sparingly for primary actions and lock states.
- **Status palette** (use consistently for file/lock states):
  - Locked — amber `#ffb224`
  - Mine / checked-out-by-me — blue `#3b9eff`
  - Synced / clean — green `#2fcf91`
  - Conflict — red `#ff5d5d`
  - Pending / in-flight — violet `#9b8cff`
- **Surfaces (dark):** app bg `#0a0d11`, panels `#11161d`, cards `#1b232c`, raised
  `#2a3543`, hairline borders `#232c36`. Text: strong `#eef2f6`, body `#dde4ec`, muted
  `#7d8b9c`.
- **Type:** display/UI = **Sora**; monospace (paths, hashes, sizes) = **Spline Sans
  Mono**. Tight tracking on headings. Eyebrows/labels in mono uppercase with wide
  tracking.
- **Feel:** subtle elevation, soft amber glow on the active lock/primary action, quiet
  hairline dividers, generous use of monospace for anything file-system-y. No skeuomorphism.

## Interaction details that matter
- The **lock state of every file must be glanceable** — badge + color + holder avatar.
  This is the product's whole reason to exist; make it the visual hero of the file list.
- Distinguish the two storage paths in the UI: small files → git (commit graph feel),
  big binaries → bucket transfer (progress bars, sizes in MB/GB). The user should feel
  that big assets go somewhere they own.
- Show **connectivity state** clearly (locks need the server): an offline banner with an
  "offline grace" note, and an obvious "you don't hold this lock" state when an edit is
  blocked.
- Empty states, in-progress transfers, and an admin **force-release** confirm dialog.

Deliver a cohesive set of high-fidelity desktop mockups for the screens above, with a
shared component kit (file row, lock badge, status pill, action bar, transfer progress,
sidebar repo item). Keep it production-realistic — real file paths, real sizes, real
names — not lorem ipsum.
