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

> Status: **Phase 2, in progress.** The full provider/worker layer now exists
> (connect, status, checkout→lock, checkin, revert→unlock, add, delete, sync)
> and is written against the **UE 5.7** interface. Not yet compiled in-engine.

## Engine support

Primary target: **UE 5.7** — the provider and state classes are written against
the exact `ISourceControlProvider` / `ISourceControlState` headers shipped with
5.7 (modeled on the engine's own `GitSourceControl` plugin so the dispatch and
threading model is the proven one). The version-sensitive parts are gated behind
`LOCKSTEP_UE_VERSION_AT_LEAST(major, minor)` (see `LockstepVersionCompat.h`) so
back-porting to earlier 5.x is mechanical; the interface's pure-virtual set does
drift across versions, so each additional engine target needs a compile pass.

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
    LockstepSourceControlProvider.{h,cpp}ISourceControlProvider (5.7)            [done]
    LockstepSourceControlCommand.{h,cpp} Async queued-work command               [done]
    ILockstepSourceControlWorker.h       Worker interface                        [done]
    LockstepSourceControlOperations.{h,cpp} Per-operation workers                [done]
    LockstepGit.{h,cpp}                  git/git-lfs CLI runner + status parse   [done]
    LockstepSourceControlModule.{h,cpp}  Module: register the provider feature   [done]
    SLockstepSourceControlSettings.{h,cpp}Slate settings panel                   [done]
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
- [x] `LockstepGit` — run git/git-lfs, parse `git status`, detect `lockable`
- [x] Async command + worker dispatch (`IQueuedWork`)
- [x] Workers: `Connect`, `UpdateStatus`, `CheckOut`→lock, `CheckIn`,
      `MarkForAdd`, `Delete`, `Revert`→unlock, `Sync`
- [x] Provider wiring + module registration
- [x] Slate settings panel
- [x] Revision-control icons via `FRevisionControlStyleManager` (5.7 style set)
- [ ] **Compile pass against UE 5.7** (not yet built in-engine)
- [ ] `git credential fill` token resolution (env var works today)
- [ ] CheckIn via temp commit-message file (avoid shell quoting)
- [ ] Read-only enforcement on disk for lockable assets not held
- [ ] **OFPA-aware** lock granularity (`__ExternalActors__` → per-actor locks)
- [ ] Soft / advisory lock mode (warn, don't block) — setting exists, not enforced
- [ ] Toolbar menu: refresh locks / admin force-unlock

## License

Business Source License 1.1 — same terms as the Lockstep server (see repo root
`LICENSE`). Free for production use under USD $1M/yr revenue.
