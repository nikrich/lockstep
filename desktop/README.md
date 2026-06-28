# Lockstep Desktop

The native desktop client for Lockstep — git-based source control for Unreal &
Unity teams with Perforce-grade file locking. Built with **Tauri 2** (Rust shell
+ a React/TypeScript UI), so it ships as a small native app on **Windows** today
and is **macOS / Linux compatible** by design (no platform-specific code paths in
the frontend; the Rust commands use cross-platform crates).

It implements the `Lockstep Desktop.dc.html` design (Claude Design project
`dbf85b8d…`) against the live coordination API in `../src`.

## What it does

- **Sign in via the browser (OAuth)** using the Worker's loopback PAT flow
  (`/auth/plugin/*`). The minted Personal Access Token is stored in the **OS
  credential store** (Windows Credential Manager / macOS Keychain / Linux Secret
  Service) — never on disk in plaintext.
- **Repository view** — your working copy grouped by state (Conflict / Changed /
  Locked by me / Locked by others / Synced), an inspector, and a commit-&-submit
  composer. Real changes come from your linked local clone (`git status`).
- **Locking** — acquire / release / request locks through the Git LFS Locking
  API. Binaries that someone else holds are shown read-only with a "you don't
  hold this lock" dialog. Admins can **force-release** stale locks.
- **Team locks** — every active lock, stale-lock detection, and OFPA per-actor
  granularity for World Partition maps.
- **Storage** — real bucket usage + the cost-vs-Git-LFS story.
- **History** — commit timeline from the local clone.
- **Settings** — soft-lock advisory mode, auto-lock, offline grace, notifications.

When no clone or live repo is wired up yet, the app shows a representative sample
working copy so every screen is explorable.

## Architecture

```
src/                     React + TypeScript UI (the design)
  lib/api.ts             Typed client for the coordination Worker
  lib/store.ts           App state + all actions (zustand)
  lib/native.ts          Typed wrappers around the Rust commands
  components/ views/      The screens from the design
src-tauri/               Rust shell
  src/oauth.rs           Browser loopback OAuth → one-time code
  src/secret.rs          PAT in the OS keychain (keyring crate)
  src/git.rs             git status / log / submit (shells to git)
  src/store.rs           Non-secret settings JSON
```

API calls route through `@tauri-apps/plugin-http` (i.e. through Rust) rather than
the webview's `fetch`, which sidesteps the Worker's browser-CORS allowlist.

## Develop

```bash
cd desktop
npm install
npm run app:dev      # launches the app with HMR (tauri dev)
```

By default the app talks to `https://api.lockstepcloud.com`. To point it at a
local Worker (`npm run dev` in the repo root → http://localhost:8787), set
`baseUrl` in the app's settings file
(`%APPDATA%/com.lockstepcloud.desktop/settings.json`) to `http://localhost:8787`.

## Build

```bash
npm run app:build    # produces the app + installers under src-tauri/target/release/bundle
```

On Windows this yields an `.msi` (WiX) and an `.exe` (NSIS) installer.

## Cross-platform note

Everything here is portable: `keyring`, `tiny_http`, `getrandom`, and the Tauri
plugins all support Windows, macOS, and Linux. To build for mac/linux later, run
`npm run app:build` on that OS (or via CI) — no source changes required. Linux
additionally needs `libwebkit2gtk` + `libsecret` at build/run time.
