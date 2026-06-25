# Lockstep Source Control (Unreal Engine plugin)

Native `ISourceControlProvider` for Unreal that gives a UE team **Perforce-grade,
engine-native file locking** on top of plain **git + Git-LFS**, with binary
blobs streamed to **your own bucket** via the [Lockstep](../../README.md)
coordination server.

- File content (history, push/pull) is delegated to `git` / `git-lfs`.
- **Locking** — the moat — talks **directly** to the Lockstep lock API over HTTP
  with a Personal Access Token (no `git lfs lock` shell-out). Lockable binary
  assets (`*.uasset`, `*.umap`, `*.fbx`, …) are **read-only in-editor** until you
  hold the lock, with a "🔒 locked by X" badge when someone else holds it.

> Status: **Phase 2, in progress.** Foundation + lock client are implemented;
> the provider/worker layer is being built (see [Roadmap](#roadmap-within-the-plugin)).

## Engine support

Targets **all of UE5** (5.0 → 5.6+). The version-sensitive parts of
`ISourceControlProvider` / `ISourceControlState` are gated behind
`LOCKSTEP_UE_VERSION_AT_LEAST(major, minor)` (see `LockstepVersionCompat.h`).
The interface's pure-virtual set genuinely drifts across these versions, so the
**first compile against a given engine may surface signature drift to reconcile**
— that is inherent to spanning seven versions, not a bug in the design.

## How it fits the server

The plugin is a data-plane client. It speaks exactly the contract in
`src/routes/` of the server repo:

| Concern | Endpoint (relative to `lfs.url`) | Server file |
|---|---|---|
| Acquire lock | `POST /locks` `{path}` → `201 {lock}` / `409 {lock}` | `src/routes/locks.ts` |
| List locks | `GET /locks[?path=]` → `{locks:[…]}` | `src/routes/locks.ts` |
| Verify (ours/theirs) | `POST /locks/verify` → `{ours:[…], theirs:[…]}` | `src/routes/locks.ts` |
| Release / force | `POST /locks/{id}/unlock` `{force}` | `src/routes/locks.ts` |
| Blob transfer | `POST /objects/batch` (handled by `git-lfs`) | `src/routes/lfs.ts` |

`lfs.url` comes from the project's `.lfsconfig` (e.g.
`https://api.lockstepcloud.com/<repo-slug>`) — that single URL is the plugin's
**Server URL** setting. Auth is a Lockstep PAT (`lsk_…`) sent as
`Authorization: Bearer …`.

## File layout

```
LockstepSourceControl.uplugin            Plugin descriptor (Editor module)
Source/LockstepSourceControl/
  LockstepSourceControl.Build.cs         Module + version-aware deps
  Private/
    LockstepVersionCompat.h              LOCKSTEP_UE_VERSION_AT_LEAST macro      [done]
    LockstepSourceControlSettings.{h,cpp}Connection settings (ini-persisted)     [done]
    LockstepLockClient.{h,cpp}           Direct HTTP client for the lock API     [done]
    LockstepSourceControlState.{h,cpp}   Per-file state (lock badge + git status)[done]
    LockstepSourceControlProvider.{h,cpp}ISourceControlProvider                  [next]
    LockstepSourceControlCommand.{h,cpp} Async queued-work command               [next]
    LockstepSourceControlWorkers.{h,cpp} Per-operation workers                   [next]
    LockstepGit.{h,cpp}                  git/git-lfs CLI runner + status parse   [next]
    LockstepSourceControlModule.{h,cpp}  Module: register the provider feature   [next]
    SLockstepSourceControlSettings.{h,cpp}Slate settings panel                   [next]
    LockstepSourceControlMenu.{h,cpp}    Toolbar: refresh locks / force-unlock   [later]
```

### What the PAT resolution does (design)

The token is **not** stored in the plugin's ini. At runtime the provider resolves
it, in order: `LOCKSTEP_TOKEN` env var → the git credential helper for the server
host (`git credential fill`, same store `git-lfs` already uses) → a prompt in the
settings panel that writes it to the OS credential store. The lock client only
ever receives the resolved token string.

## Install (once the provider layer lands)

1. Copy `plugin/LockstepSourceControl/` into your project's `Plugins/` folder
   (or the engine's `Engine/Plugins/`).
2. Regenerate project files and build the editor target.
3. In-editor: **Revision Control → Connect**, pick **Lockstep**, paste the
   Server URL (your `.lfsconfig` `lfs.url`) and PAT, **Accept Settings**.
4. Ensure the project has the `.gitattributes` / `.lfsconfig` from
   [`examples/`](../../examples/) committed at its root.

## Roadmap within the plugin

- [x] Plugin descriptor, build rules, version-compat shim
- [x] Settings store
- [x] Lock client (acquire / list / verify / release+force) — dual-threaded HTTP
- [x] Per-file state object (lock badge, checkout/edit semantics)
- [ ] `LockstepGit` — run git/git-lfs, parse `git status`/`lfs` into working state
- [ ] Async command + worker dispatch (`IQueuedWork`)
- [ ] Workers: `Connect`, `UpdateStatus`, `CheckOut`→lock, `CheckIn`,
      `MarkForAdd`, `Delete`, `Revert`→unlock, `Sync`
- [ ] Provider wiring + module registration
- [ ] Slate settings panel
- [ ] Read-only enforcement on disk for lockable assets not held
- [ ] **OFPA-aware** lock granularity (`__ExternalActors__` → per-actor locks)
- [ ] Soft / advisory lock mode (warn, don't block)

## License

Business Source License 1.1 — same terms as the Lockstep server (see repo root
`LICENSE`). Free for production use under USD $1M/yr revenue.
