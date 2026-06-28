// The single source of truth for the desktop app. Holds auth/session, the
// active org+repo, the merged working-copy file list, server locks, and all the
// actions the views call. Everything that touches the network goes through
// LockstepApi; everything that touches the machine goes through native.ts.

import { create } from "zustand";
import { DEFAULT_API, LockstepApi } from "./api";
import * as native from "./native";
import {
  DEMO_FILES,
  DEMO_TEAM,
  humanSize,
  splitPath,
  storeFor,
} from "./files";
import type {
  ActivityItem,
  BillingInfo,
  Org,
  Repo,
  RepoFile,
  ServerLock,
  StorageUsage,
  Toast,
  UserProfile,
  ViewKey,
} from "./types";

export interface TeamLock {
  id: string;
  path: string;
  owner: string;
  mine: boolean;
  size: string;
  age: string;
  stale: boolean;
}

interface Settings {
  baseUrl: string;
  orgId: string | null;
  repoSlug: string | null;
  localPath: string | null;
  softLock: boolean;
  autoLock: boolean;
  offlineGrace: boolean;
  notifyRequests: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  baseUrl: DEFAULT_API,
  orgId: null,
  repoSlug: null,
  localPath: null,
  softLock: false,
  autoLock: true,
  offlineGrace: true,
  notifyRequests: true,
};

interface State {
  ready: boolean;
  online: boolean;
  demo: boolean; // true when showing the sample working copy (no live data)

  // auth
  token: string | null;
  user: UserProfile | null;
  signingIn: boolean;
  authError: string | null;

  // config
  settings: Settings;

  // control plane
  orgs: Org[];
  repos: Repo[];
  storage: StorageUsage | null;
  billing: BillingInfo | null;
  activity: ActivityItem[];

  // working copy + locks
  branch: string;
  files: RepoFile[];
  locks: TeamLock[];
  team: string[];
  refreshing: boolean;

  // ui
  view: ViewKey;
  selected: string | null;
  commitMsg: string;
  releaseLocks: boolean;
  syncing: boolean;
  syncPct: number;
  transferSet: string[];
  transferLabel: string;
  blocked: { path: string; owner: string; age: string } | null;
  diff: {
    path: string;
    store: RepoFile["store"];
    loading: boolean;
    text: string;
    binary: boolean;
    error: string | null;
  } | null;
  toast: Toast | null;
  onboardStep: number;
  locksScope: "all" | "mine" | "stale";

  api: () => LockstepApi;

  // actions
  init: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setView: (v: ViewKey) => void;
  select: (p: string) => void;
  setCommitMsg: (m: string) => void;
  toggleRelease: () => void;
  toggleSetting: (k: keyof Settings) => void;
  setLocksScope: (v: "all" | "mine" | "stale") => void;
  setOrg: (id: string) => Promise<void>;
  setRepo: (slug: string) => Promise<void>;
  pickLocalRepo: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  lockToEdit: (path: string) => Promise<void>;
  forceRelease: (path: string) => Promise<void>;
  requestLock: () => void;
  dismissBlocked: () => void;
  discardAll: () => Promise<void>;
  toggleStage: (path: string) => void;
  stageAll: () => void;
  releaseAll: () => Promise<void>;
  openDiff: (file: RepoFile) => Promise<void>;
  closeDiff: () => void;
  startSync: () => Promise<void>;
  onbNext: () => void;
  onbBack: () => void;
  onbFinish: () => Promise<void>;
  flash: (msg: string, icon?: string, color?: string) => void;
}

function relAge(iso: string): { age: string; hours: number } {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  const hours = mins / 60;
  if (mins < 60) return { age: `${mins}m`, hours };
  const h = Math.floor(hours);
  const m = mins % 60;
  if (h < 24) return { age: `${h}h ${String(m).padStart(2, "0")}m`, hours };
  return { age: `${Math.floor(h / 24)}d`, hours };
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;

export const useStore = create<State>((set, get) => ({
  ready: false,
  online: true,
  demo: true,

  token: null,
  user: null,
  signingIn: false,
  authError: null,

  settings: DEFAULT_SETTINGS,

  orgs: [],
  repos: [],
  storage: null,
  billing: null,
  activity: [],

  branch: "", // set from real git once a local clone is linked (pickLocalRepo)
  files: DEMO_FILES,
  locks: [],
  team: DEMO_TEAM,
  refreshing: false,

  view: "repo",
  selected: "Content/Maps/Arena.umap",
  commitMsg: "",
  releaseLocks: true,
  syncing: false,
  syncPct: 0,
  transferSet: [],
  transferLabel: "",
  blocked: null,
  diff: null,
  toast: null,
  onboardStep: 0,
  locksScope: "all",

  api: () => {
    const s = get();
    return new LockstepApi(s.settings.baseUrl, s.token);
  },

  flash(msg, icon = "check", color = "var(--status-synced)") {
    set({ toast: { msg, icon, color } });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2800);
  },

  async init() {
    let saved: Partial<Settings> = {};
    try {
      saved = await native.loadSettings<Partial<Settings>>();
    } catch {
      /* first run */
    }
    const settings: Settings = { ...DEFAULT_SETTINGS, ...saved };
    let token: string | null = null;
    try {
      token = await native.getToken();
    } catch {
      /* keychain unavailable */
    }
    set({ settings, token });

    if (!token) {
      // No session yet → land on onboarding.
      set({ ready: true, view: "onboarding", onboardStep: 0 });
      return;
    }

    try {
      const api = new LockstepApi(settings.baseUrl, token);
      const { user } = await api.me();
      set({ user, online: true });
      const orgs = await api.listOrgs();
      set({ orgs });
      const orgId = settings.orgId && orgs.find((o) => o.id === settings.orgId)
        ? settings.orgId
        : orgs[0]?.id ?? null;
      if (orgId) {
        await get().setOrg(orgId);
      }
    } catch (e) {
      // Token invalid/expired or offline — show onboarding to re-auth.
      set({ online: false, authError: (e as Error).message });
      set({ view: "onboarding", onboardStep: 0 });
    } finally {
      set({ ready: true });
    }
  },

  async login() {
    set({ signingIn: true, authError: null });
    try {
      const base = get().settings.baseUrl;
      const { code } = await native.oauthLoopback(base);
      const api = new LockstepApi(base, null);
      const { token } = await api.exchangePluginCode(code);
      await native.storeToken(token);
      set({ token });
      const authed = new LockstepApi(base, token);
      const { user } = await authed.me();
      set({ user, online: true });
      const orgs = await authed.listOrgs();
      set({ orgs, onboardStep: 1 });
      get().flash("Signed in to Lockstep", "circle-check", "var(--status-synced)");
    } catch (e) {
      set({ authError: (e as Error).message });
      get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
    } finally {
      set({ signingIn: false });
    }
  },

  async logout() {
    try {
      await native.clearToken();
    } catch {
      /* ignore */
    }
    if (syncTimer) clearInterval(syncTimer);
    set({
      token: null,
      user: null,
      orgs: [],
      repos: [],
      storage: null,
      billing: null,
      activity: [],
      locks: [],
      files: DEMO_FILES,
      team: DEMO_TEAM,
      demo: true,
      view: "onboarding",
      onboardStep: 0,
    });
    await persist(get);
  },

  setView(v) {
    set({ view: v });
  },
  select(p) {
    set({ selected: p });
  },
  setCommitMsg(m) {
    set({ commitMsg: m });
  },
  toggleRelease() {
    set((s) => ({ releaseLocks: !s.releaseLocks }));
  },
  toggleSetting(k) {
    set((s) => ({ settings: { ...s.settings, [k]: !s.settings[k] } }) as Partial<State>);
    void persist(get);
  },
  setLocksScope(v) {
    set({ locksScope: v });
  },

  async setOrg(id) {
    set((s) => ({ settings: { ...s.settings, orgId: id } }));
    void persist(get);
    const api = get().api();
    try {
      const repos = await api.listRepos(id);
      set({ repos });
      const cur = get().settings.repoSlug;
      const slug = cur && repos.find((r) => r.slug === cur) ? cur : repos[0]?.slug;
      if (slug) await get().setRepo(slug);
      // Background: storage + billing + activity for the Storage/History views.
      // Usage (bytes/objects) and config (provider/bucket) come from two
      // endpoints; merge them into the one StorageUsage the views read.
      void Promise.all([
        api.storageUsage(id),
        api.storageConfig(id).catch(() => ({ storage: null })),
      ])
        .then(([usage, cfg]) =>
          set({
            storage: { ...usage, provider: cfg.storage?.provider, bucket: cfg.storage?.bucket },
          }),
        )
        .catch(() => {});
      void api.billing(id).then((billing) => set({ billing })).catch(() => {});
      void api.activity(id).then((activity) => set({ activity })).catch(() => {});
      void api
        .members(id)
        .then((m) => set({ team: m.members.map((x) => x.name || x.email || "Member") }))
        .catch(() => {});
    } catch (e) {
      set({ online: false });
      get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
    }
  },

  async setRepo(slug) {
    set((s) => ({ settings: { ...s.settings, repoSlug: slug } }));
    void persist(get);
    await get().refresh();
  },

  async pickLocalRepo() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true, multiple: false, title: "Choose your local clone" });
    if (!dir || typeof dir !== "string") return;
    try {
      const info = await native.gitRepoInfo(dir);
      if (!info.is_repo) {
        get().flash("That folder isn't a git repository", "triangle-alert", "var(--status-conflict)");
        return;
      }
      set((s) => ({ settings: { ...s.settings, localPath: info.root }, branch: info.branch }));
      void persist(get);
      await get().refresh();
      get().flash(`Linked ${info.root.split(/[\\/]/).pop()} · ${info.branch}`, "folder-git-2", "var(--status-mine)");
    } catch (e) {
      get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
    }
  },

  // `silent` is for the background auto-refresh (focus + poll): it skips the
  // spinner and the error toast so periodic refreshes don't flicker or nag.
  async refresh(silent = false) {
    const s = get();
    const slug = s.settings.repoSlug;
    if (!s.token || !slug) {
      // No live repo wired up — keep the sample working copy on screen.
      set({ demo: true });
      return;
    }
    if (!silent) set({ refreshing: true });
    const api = s.api();
    try {
      // 1) Server locks (the source of truth for who holds what).
      const verify = await api.verifyLocks(slug);
      const lockRows: TeamLock[] = [];
      const lockByPath = new Map<string, { id: string; owner: string; mine: boolean; age: string; stale: boolean }>();
      const pushLock = (l: ServerLock, mine: boolean) => {
        const { age, hours } = relAge(l.locked_at);
        const stale = hours > 12; // no heartbeat channel yet → treat old locks as stale
        lockByPath.set(l.path, { id: l.id, owner: mine ? "You" : l.owner.name, mine, age, stale });
        lockRows.push({
          id: l.id,
          path: l.path,
          owner: mine ? "You" : l.owner.name,
          mine,
          size: "—",
          age,
          stale,
        });
      };
      verify.ours.forEach((l) => pushLock(l, true));
      verify.theirs.forEach((l) => pushLock(l, false));

      // 2) Local working-copy changes (optional — only if a clone is linked).
      let files: RepoFile[] = [];
      const local = s.settings.localPath;
      if (local) {
        // Keep the header branch honest with whatever the clone is on now.
        try {
          const info = await native.gitRepoInfo(local);
          if (info.is_repo && info.branch) set({ branch: info.branch });
        } catch {
          /* not a repo / git missing — leave branch as-is */
        }
        try {
          const changed = await native.gitStatus(local);
          files = changed.map((c) => {
            const lk = lockByPath.get(c.path);
            const state = lk
              ? lk.mine
                ? "mine"
                : "locked"
              : c.work === "U" || c.index === "U"
                ? "conflict"
                : "modified";
            return {
              path: c.path,
              size: "—",
              state,
              owner: lk ? lk.owner : null,
              age: lk?.age,
              stale: lk?.stale,
              staged: c.staged,
              store: storeFor(c.path),
              lockId: lk?.id,
            } as RepoFile;
          });
        } catch {
          /* git not available / not a repo */
        }
      }

      // 3) Locked-but-unchanged files still belong in the list so you can see them.
      for (const [path, lk] of lockByPath) {
        if (!files.find((f) => f.path === path)) {
          files.push({
            path,
            size: "—",
            state: lk.mine ? "mine" : "locked",
            owner: lk.owner,
            age: lk.age,
            stale: lk.stale,
            staged: false,
            store: storeFor(path),
            lockId: lk.id,
          });
        }
      }

      // Update team-lock sizes from any matching working-copy entry.
      for (const row of lockRows) {
        const f = files.find((x) => x.path === row.path);
        if (f && f.size !== "—") row.size = f.size;
      }

      // We're signed in to a real repo: show the real working copy even when it's
      // empty (clean tree, no locks). Never fall back to sample data here, and
      // keep demo:false so lock actions hit the server.
      const cur = get().selected;
      set({
        files,
        locks: lockRows,
        demo: false,
        online: true,
        selected: files.some((f) => f.path === cur) ? cur : files[0]?.path ?? "",
      });
    } catch (e) {
      set({ online: false });
      if (!silent) get().flash((e as Error).message, "wifi-off", "var(--status-conflict)");
    } finally {
      if (!silent) set({ refreshing: false });
    }
  },

  async lockToEdit(path) {
    const s = get();
    const f = s.files.find((x) => x.path === path);
    if (!f) return;
    const slug = s.settings.repoSlug;
    const live = !!(s.token && slug && !s.demo);

    if (f.state === "locked") {
      if (s.settings.softLock) {
        get().flash("Soft-lock: editing anyway (advisory only)", "triangle-alert", "var(--amber-400)");
      } else {
        set({ blocked: { path, owner: f.owner || "someone", age: f.age || "just now" } });
      }
      return;
    }

    if (f.state === "mine") {
      // Release my lock. Resolve the lock id from the file or the locks list
      // (the merge may not have stamped it onto every row).
      const id = f.lockId || s.locks.find((l) => l.path === path)?.id;
      if (live) {
        if (!id) return get().flash("Couldn't find this lock to release — try Sync", "triangle-alert", "var(--status-conflict)");
        try {
          await s.api().unlock(slug!, id);
        } catch (e) {
          return get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
        }
      }
      patchFile(set, path, { state: "modified", owner: null, lockId: undefined });
      set((st) => ({ locks: st.locks.filter((l) => l.path !== path) }));
      get().flash("Lock released", "unlock", "var(--text-secondary)");
      if (live) void get().refresh();
      return;
    }

    // Acquire a lock to edit.
    if (live) {
      try {
        const { lock } = await s.api().acquireLock(slug!, path);
        patchFile(set, path, { state: "mine", owner: "You", lockId: lock.id });
      } catch (e) {
        return get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
      }
    } else {
      patchFile(set, path, { state: "mine", owner: "You" });
    }
    get().flash("You hold the lock", "lock", "var(--amber-400)");
    if (live) void get().refresh();
  },

  async forceRelease(path) {
    const s = get();
    const f = s.files.find((x) => x.path === path) || null;
    const lock = s.locks.find((l) => l.path === path);
    const slug = s.settings.repoSlug;
    const id = f?.lockId || lock?.id;
    if (s.token && slug && id && !s.demo) {
      try {
        await s.api().unlock(slug, id, true);
      } catch (e) {
        return get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
      }
    }
    patchFile(set, path, { state: "synced", owner: null, stale: false, staged: false, lockId: undefined });
    set((st) => ({ locks: st.locks.filter((l) => l.path !== path) }));
    get().flash("Lock force-released", "unlock", "var(--amber-400)");
    if (!s.demo) void get().refresh();
  },

  requestLock() {
    const b = get().blocked;
    set({ blocked: null });
    if (b) get().flash(`Lock request sent to ${b.owner}`, "mail", "var(--status-mine)");
  },
  dismissBlocked() {
    set({ blocked: null });
  },
  async discardAll() {
    const s = get();
    const local = s.settings.localPath;
    if (!local) {
      get().flash("Link a local clone to discard changes", "triangle-alert", "var(--status-conflict)");
      return;
    }
    // Discard the visible working-copy changes (the Changed + Conflict groups).
    const changed = s.files.filter((f) => f.state === "modified" || f.state === "conflict");
    if (changed.length === 0) {
      get().flash("No changes to discard", "info", "var(--text-secondary)");
      return;
    }
    const n = changed.length;
    const { ask } = await import("@tauri-apps/plugin-dialog");
    const ok = await ask(
      `Revert ${n} file${n === 1 ? "" : "s"} to the last commit. This can't be undone.`,
      { title: `Discard ${n} change${n === 1 ? "" : "s"}?`, kind: "warning", okLabel: "Discard", cancelLabel: "Cancel" },
    );
    if (!ok) return;
    try {
      await native.gitDiscard(local, changed.map((f) => f.path));
      get().flash(`Discarded ${n} file${n === 1 ? "" : "s"}`, "rotate-ccw", "var(--text-secondary)");
      await get().refresh();
    } catch (e) {
      get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
    }
  },

  // Staging is a UI selection of which changed files to include in the next
  // submit (gitSubmit does the actual `git add` of these paths). Only modified
  // files can be staged.
  toggleStage(path) {
    set((s) => ({
      files: s.files.map((f) =>
        f.path === path && f.state === "modified" ? { ...f, staged: !f.staged } : f,
      ),
    }));
  },

  stageAll() {
    const mod = get().files.filter((f) => f.state === "modified");
    if (mod.length === 0) {
      get().flash("No changed files to stage", "info", "var(--text-secondary)");
      return;
    }
    // Toggle: if everything's already staged, clicking again unstages the group.
    const next = !mod.every((f) => f.staged);
    set((s) => ({
      files: s.files.map((f) => (f.state === "modified" ? { ...f, staged: next } : f)),
    }));
    get().flash(
      `${mod.length} file${mod.length === 1 ? "" : "s"} ${next ? "staged" : "unstaged"}`,
      next ? "check" : "minus",
      "var(--status-synced)",
    );
  },

  async releaseAll() {
    const s = get();
    const mine = s.files.filter((f) => f.state === "mine");
    if (mine.length === 0) {
      get().flash("You hold no locks to release", "info", "var(--text-secondary)");
      return;
    }
    const slug = s.settings.repoSlug;
    const live = !!(s.token && slug && !s.demo);
    let released = 0;
    for (const f of mine) {
      const id = f.lockId || s.locks.find((l) => l.path === f.path)?.id;
      if (live) {
        if (!id) continue; // can't resolve the lock id — leave it for a Sync
        try {
          await s.api().unlock(slug!, id);
        } catch {
          continue; // skip ones that fail; report the rest
        }
      }
      patchFile(set, f.path, { state: "modified", owner: null, lockId: undefined });
      set((st) => ({ locks: st.locks.filter((l) => l.path !== f.path) }));
      released++;
    }
    const failed = mine.length - released;
    get().flash(
      `Released ${released} lock${released === 1 ? "" : "s"}${failed ? ` · ${failed} need a Sync` : ""}`,
      "unlock",
      failed ? "var(--status-conflict)" : "var(--amber-400)",
    );
    if (live) void get().refresh();
  },

  async openDiff(file) {
    const local = get().settings.localPath;
    set({ diff: { path: file.path, store: file.store, loading: true, text: "", binary: false, error: null } });
    if (!local) {
      set({ diff: { path: file.path, store: file.store, loading: false, text: "", binary: false, error: "Link a local clone to view diffs." } });
      return;
    }
    try {
      const r = await native.gitDiff(local, file.path);
      // Only keep the diff if the user hasn't closed it or moved to another file.
      if (get().diff?.path !== file.path) return;
      set({ diff: { path: file.path, store: file.store, loading: false, text: r.diff, binary: r.binary, error: null } });
    } catch (e) {
      if (get().diff?.path !== file.path) return;
      set({ diff: { path: file.path, store: file.store, loading: false, text: "", binary: false, error: (e as Error).message } });
    }
  },

  closeDiff() {
    set({ diff: null });
  },

  async startSync() {
    const s = get();
    if (s.syncing) return;
    const staged = s.files.filter((f) => f.staged);
    if (staged.length === 0) {
      get().flash("Nothing staged to submit", "info", "var(--text-secondary)");
      return;
    }
    const up = staged.map((f) => f.path);
    set({ syncing: true, syncPct: 0, transferSet: up, transferLabel: "Preparing presigned URLs…" });

    const live = !!(s.token && s.settings.repoSlug && s.settings.localPath && !s.demo);
    if (live) {
      // Real submit: git add/commit/push (git-lfs streams blobs to the bucket
      // using the presigned URLs the Worker hands out). We drive a progress
      // animation while the push runs.
      const msg = s.commitMsg.trim() || `Submit ${up.length} file${up.length === 1 ? "" : "s"}`;
      animateSync(set, get);
      try {
        const hash = await native.gitSubmit(s.settings.localPath!, msg, up);
        // Tell the server so the submit shows in the org activity feed. Code-only
        // pushes never hit LFS, so this is the only signal for them. Best-effort.
        void s.api().reportPush(s.settings.repoSlug!, up.length, hash).catch(() => {});
        finishSync(set, get, up, true);
      } catch (e) {
        if (syncTimer) clearInterval(syncTimer);
        set({ syncing: false, syncPct: 0, transferSet: [], transferLabel: "" });
        get().flash((e as Error).message, "triangle-alert", "var(--status-conflict)");
      }
      return;
    }

    // Demo submit: simulate the transfer so the UI is explorable without a clone.
    let pct = 0;
    syncTimer = setInterval(() => {
      pct += Math.random() * 9 + 5;
      if (pct >= 100) {
        if (syncTimer) clearInterval(syncTimer);
        finishSync(set, get, up, false);
        return;
      }
      const idx = Math.min(up.length - 1, Math.floor((pct / 100) * up.length));
      const nm = up[idx].split("/").pop();
      set({
        syncPct: pct,
        transferLabel: pct < 14 ? "Preparing presigned URLs…" : `Uploading ${nm} → bucket`,
      });
    }, 230);
  },

  onbNext() {
    set((s) => ({ onboardStep: Math.min(2, s.onboardStep + 1) }));
  },
  onbBack() {
    set((s) => ({ onboardStep: Math.max(0, s.onboardStep - 1) }));
  },
  async onbFinish() {
    set({ view: "repo", onboardStep: 0 });
    await get().refresh();
    get().flash("Ready · code from git, blobs from your bucket", "circle-check", "var(--status-synced)");
  },
}));

// ---- helpers ----

function patchFile(
  set: (fn: (s: State) => Partial<State>) => void,
  path: string,
  patch: Partial<RepoFile>,
) {
  set((s) => ({ files: s.files.map((f) => (f.path === path ? { ...f, ...patch } : f)) }));
}

function animateSync(
  set: (p: Partial<State> | ((s: State) => Partial<State>)) => void,
  get: () => State,
) {
  let pct = 0;
  if (syncTimer) clearInterval(syncTimer);
  const up = get().transferSet;
  syncTimer = setInterval(() => {
    pct = Math.min(96, pct + Math.random() * 7 + 3); // cap until the push really returns
    const idx = Math.min(up.length - 1, Math.floor((pct / 100) * up.length));
    const nm = up[idx]?.split("/").pop() ?? "";
    set({
      syncPct: pct,
      transferLabel: pct < 14 ? "Preparing presigned URLs…" : `Pushing ${nm} → bucket`,
    });
  }, 240);
}

function finishSync(
  set: (p: Partial<State> | ((s: State) => Partial<State>)) => void,
  get: () => State,
  up: string[],
  live: boolean,
) {
  set((s) => ({
    files: s.files.map((f) =>
      up.includes(f.path) ? { ...f, state: "synced", staged: false, owner: null } : f,
    ),
    syncing: false,
    syncPct: 0,
    transferSet: [],
    transferLabel: "",
    commitMsg: "",
  }));
  get().flash(
    `Submitted · ${up.length} file${up.length === 1 ? "" : "s"} · bytes went straight to your bucket`,
    "circle-check",
    "var(--status-synced)",
  );
  if (live) void get().refresh();
}

async function persist(get: () => State) {
  try {
    await native.saveSettings(get().settings as unknown as Record<string, unknown>);
  } catch {
    /* best effort */
  }
}

// Re-export a couple of formatting helpers views need.
export { humanSize, splitPath };
export type { Org, Repo, BillingInfo, StorageUsage, ActivityItem };
