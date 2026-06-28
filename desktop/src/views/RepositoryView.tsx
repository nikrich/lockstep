// The home screen: working-copy changes grouped by lock/sync state, an inspector
// for the selected file, and a commit-&-submit composer. Mirrors the design's
// Repository view.
import type { CSSProperties } from "react";
import { useStore } from "../lib/store";
import type { RepoFile } from "../lib/types";
import { STATUS, extOf, splitPath, tintForExt } from "../lib/files";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";

const extChip = (path: string): CSSProperties => {
  const et = tintForExt(extOf(path));
  return {
    width: 18,
    height: 18,
    flex: "none",
    borderRadius: "var(--radius-xs)",
    background: `color-mix(in srgb, ${et} 16%, transparent)`,
    color: et,
    fontWeight: 700,
    fontSize: 8,
    lineHeight: "18px",
    textAlign: "center",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
  };
};

const storeChip = (store: "git" | "bucket"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  flex: "none",
  height: 17,
  padding: "0 6px",
  borderRadius: "var(--radius-xs)",
  fontWeight: 600,
  fontSize: 9,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  fontFamily: "var(--font-mono)",
  background:
    store === "bucket"
      ? "color-mix(in srgb, var(--amber-400) 13%, transparent)"
      : "color-mix(in srgb, var(--status-synced) 13%, transparent)",
  color: store === "bucket" ? "var(--amber-300)" : "var(--status-synced)",
});

function badge(state: RepoFile["state"]): CSSProperties {
  const st = STATUS[state];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    flex: "none",
    height: 19,
    padding: "0 8px",
    borderRadius: "var(--radius-pill)",
    background: st.bg,
    color: st.c,
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: "nowrap",
  };
}

function actionFor(f: RepoFile): { icon: string; title: string } {
  if (f.state === "mine") return { icon: "unlock", title: "Release lock" };
  if (f.state === "locked") return f.stale ? { icon: "unlock", title: "Force release (stale)" } : { icon: "mail", title: "Request lock" };
  if (f.state === "conflict") return { icon: "git-merge", title: "Resolve conflict" };
  return { icon: "lock", title: "Lock to edit" };
}

function FileRow({ f }: { f: RepoFile }) {
  const selected = useStore((s) => s.selected === f.path);
  const select = useStore((s) => s.select);
  const lockToEdit = useStore((s) => s.lockToEdit);
  const forceRelease = useStore((s) => s.forceRelease);
  const toggleStage = useStore((s) => s.toggleStage);
  const openDiff = useStore((s) => s.openDiff);
  const flash = useStore((s) => s.flash);

  const canDiff = f.state === "modified" || f.state === "conflict";
  const syncing = useStore((s) => s.syncing);
  const transferSet = useStore((s) => s.transferSet);
  const syncPct = useStore((s) => s.syncPct);

  const { dir, name } = splitPath(f.path);
  const st = STATUS[f.state];
  const transferring = syncing && transferSet.includes(f.path);
  const pct = Math.min(100, syncPct).toFixed(0);
  const a = actionFor(f);

  const border =
    f.state === "mine"
      ? "var(--status-mine)"
      : f.state === "locked"
        ? "var(--status-locked)"
        : f.state === "conflict"
          ? "var(--status-conflict)"
          : f.state === "modified"
            ? "var(--slate-500)"
            : "transparent";
  const glow = f.state === "mine";

  const onAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (f.state === "locked" && f.stale) return void forceRelease(f.path);
    if (f.state === "conflict") return flash("Conflict resolver coming soon", "git-merge", "var(--status-conflict)");
    void lockToEdit(f.path);
  };

  return (
    <div
      onClick={() => select(f.path)}
      onDoubleClick={() => canDiff && void openDiff(f)}
      title={canDiff ? "Double-click to view diff" : undefined}
      className="no-select"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 38,
        padding: "0 14px 0 12px",
        cursor: "pointer",
        borderLeft: `2px solid ${selected ? "var(--status-mine)" : border}`,
        background: selected ? "var(--status-mine-bg)" : "transparent",
        boxShadow: glow && !selected ? "inset 0 0 0 1px color-mix(in srgb, var(--amber-400) 12%, transparent)" : "none",
      }}
    >
      {f.state === "modified" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleStage(f.path);
          }}
          title={f.staged ? "Unstage" : "Stage"}
          style={{
            width: 16,
            height: 16,
            flex: "none",
            padding: 0,
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: `1px solid ${f.staged ? "var(--status-synced)" : "var(--border-strong)"}`,
            background: f.staged ? "var(--status-synced)" : "transparent",
          }}
        >
          {f.staged && <Icon name="check" size={11} color="var(--brand-contrast)" />}
        </button>
      )}
      <span style={extChip(f.path)}>{(extOf(f.path) || "∙").slice(0, 3)}</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          fontWeight: 500,
          fontSize: 13,
          fontFamily: "var(--font-mono)",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>{dir}</span>
        <span style={{ color: "var(--text-body)" }}>{name}</span>
      </span>

      {transferring ? (
        <span style={{ display: "flex", alignItems: "center", gap: 7, flex: "none", width: 120 }}>
          <span style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--surface-sunken)", overflow: "hidden" }}>
            <span
              style={{
                display: "block",
                height: "100%",
                borderRadius: 3,
                background: "var(--status-pending)",
                width: `${pct}%`,
                transition: "width .25s linear",
              }}
            />
          </span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--status-pending)", width: 30, textAlign: "right" }}>
            {pct}%
          </span>
        </span>
      ) : (
        <>
          <span style={storeChip(f.store)} title={f.store === "bucket" ? "Large binary → streamed to your bucket" : "Small file → committed to git"}>
            {f.store}
          </span>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", flex: "none", width: 52, textAlign: "right" }}>
            {f.size}
          </span>
          {f.owner && f.state !== "synced" && f.state !== "modified" && <Avatar name={f.owner} size={20} />}
          <span style={badge(f.state)}>
            <span style={{ fontSize: 8, lineHeight: 1 }}>{st.glyph}</span>
            {st.badge}
          </span>
          {canDiff && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void openDiff(f);
              }}
              title="View diff"
              style={{ width: 26, height: 26, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "var(--surface-card)", color: "var(--text-muted)", cursor: "pointer" }}
            >
              <Icon name="file-diff" size={14} />
            </button>
          )}
          <button
            onClick={onAction}
            title={a.title}
            style={{
              width: 26,
              height: 26,
              flex: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-default)",
              background: "var(--surface-card)",
              color: f.state === "mine" ? "var(--amber-400)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <Icon name={a.icon} size={14} />
          </button>
        </>
      )}
    </div>
  );
}

interface Group {
  key: string;
  label: string;
  icon: string;
  tint: string;
  files: RepoFile[];
  bulk?: string;
  onBulk?: () => void;
}

export function RepositoryView() {
  const files = useStore((s) => s.files);
  const selectedPath = useStore((s) => s.selected);
  const stageAll = useStore((s) => s.stageAll);
  const releaseAll = useStore((s) => s.releaseAll);
  const hasClone = useStore((s) => !!s.settings.localPath);
  const pickLocalRepo = useStore((s) => s.pickLocalRepo);
  const refresh = useStore((s) => s.refresh);

  const by = (st: RepoFile["state"]) => files.filter((f) => f.state === st);
  const groups: Group[] = [
    { key: "conflict", label: "Conflict", icon: "triangle-alert", tint: "var(--status-conflict)", files: by("conflict") },
    { key: "changed", label: "Changed", icon: "pencil", tint: "var(--slate-300)", files: by("modified"), bulk: "Stage all", onBulk: stageAll },
    { key: "mine", label: "Locked by me", icon: "lock", tint: "var(--status-mine)", files: by("mine"), bulk: "Release all", onBulk: () => void releaseAll() },
    { key: "others", label: "Locked by others", icon: "users", tint: "var(--status-locked)", files: by("locked") },
    { key: "synced", label: "Synced", icon: "check", tint: "var(--status-synced)", files: by("synced") },
  ].filter((g) => g.files.length > 0);

  const stagedCount = files.filter((f) => f.staged).length;
  const myLocks = files.filter((f) => f.state === "mine").length;
  const sel = files.find((f) => f.path === selectedPath) || null;

  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* toolbar */}
        <div
          style={{
            height: 52,
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>Repository</div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
              {files.length} tracked · {stagedCount} staged · {myLocks} locked by you
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="search" size={15} color="var(--text-muted)" />
            <Icon name="list-filter" size={15} color="var(--text-muted)" />
          </div>
        </div>

        {/* grouped file list */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 8 }}>
          {groups.length === 0 && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40, textAlign: "center" }}>
              <span style={{ width: 52, height: 52, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface-sunken)", border: "1px solid var(--hairline)", color: hasClone ? "var(--status-synced)" : "var(--text-muted)" }}>
                <Icon name={hasClone ? "check-check" : "folder-git-2"} size={24} />
              </span>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>
                {hasClone ? "Working tree clean" : "No local clone linked"}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)", maxWidth: 320, fontFamily: "var(--font-mono)" }}>
                {hasClone
                  ? "No changes to submit and no locks held. Edit a file (or lock one) and it'll show up here."
                  : "Link your local clone to see your working copy, changes, and locks."}
              </div>
              <button
                onClick={() => (hasClone ? void refresh() : void pickLocalRepo())}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 16px", marginTop: 4, borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", background: "var(--surface-card)", color: "var(--text-body)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                <Icon name={hasClone ? "refresh-cw" : "folder"} size={15} />
                {hasClone ? "Refresh" : "Link a clone"}
              </button>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 7px" }}>
                <Icon name={g.icon} size={13} color={g.tint} />
                <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: g.tint }}>
                  {g.label}
                </span>
                <span style={{ fontWeight: 600, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{g.files.length}</span>
                <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
                {g.bulk && g.onBulk && (
                  <button
                    onClick={g.onBulk}
                    style={{ fontWeight: 600, fontSize: 11, fontFamily: "var(--font-mono)", color: g.tint, background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px" }}
                  >
                    {g.bulk}
                  </button>
                )}
              </div>
              {g.files.map((f) => (
                <FileRow key={f.path} f={f} />
              ))}
            </div>
          ))}
        </div>

        <ActionBar />
      </div>

      <Inspector sel={sel} />
    </div>
  );
}

function ActionBar() {
  const files = useStore((s) => s.files);
  const syncing = useStore((s) => s.syncing);
  const syncPct = useStore((s) => s.syncPct);
  const transferLabel = useStore((s) => s.transferLabel);
  const startSync = useStore((s) => s.startSync);
  const discardAll = useStore((s) => s.discardAll);

  const staged = files.filter((f) => f.staged);
  const gitStaged = staged.filter((f) => f.store === "git").length;
  const bucketStaged = staged.filter((f) => f.store === "bucket").length;
  const pct = Math.min(100, syncPct).toFixed(0);

  return (
    <div style={{ flex: "none", borderTop: "1px solid var(--hairline)", background: "var(--bg-panel)" }}>
      {syncing && (
        <>
          <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="ls-spin" style={{ display: "inline-flex" }}>
              <Icon name="refresh-cw" size={13} color="var(--status-pending)" />
            </span>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{transferLabel}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--status-pending)" }}>{pct}%</span>
          </div>
          <div style={{ margin: "8px 16px 0", height: 5, borderRadius: 3, background: "var(--surface-sunken)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", borderRadius: 3, background: "var(--status-pending)", width: `${pct}%`, transition: "width .2s linear" }} />
          </div>
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>
            {staged.length ? `${staged.length} file${staged.length === 1 ? "" : "s"} ready to submit` : "Nothing staged"}
          </div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
            {gitStaged} to git · {bucketStaged} to bucket
          </div>
        </div>
        <button
          onClick={discardAll}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-body)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
        >
          Discard
        </button>
        <button
          onClick={() => startSync()}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 16px", borderRadius: "var(--radius-md)", border: "1px solid transparent", background: "var(--brand)", color: "var(--brand-contrast)", cursor: "pointer", fontWeight: 600, fontSize: 13, boxShadow: "var(--glow-amber)" }}
        >
          <Icon name="arrow-up-from-line" size={15} />
          {syncing ? "Submitting…" : `Submit${staged.length ? " " + staged.length : ""}`}
        </button>
      </div>
    </div>
  );
}

function Inspector({ sel }: { sel: RepoFile | null }) {
  const commitMsg = useStore((s) => s.commitMsg);
  const setCommitMsg = useStore((s) => s.setCommitMsg);
  const releaseLocks = useStore((s) => s.releaseLocks);
  const toggleRelease = useStore((s) => s.toggleRelease);
  const lockToEdit = useStore((s) => s.lockToEdit);
  const openDiff = useStore((s) => s.openDiff);
  const startSync = useStore((s) => s.startSync);
  const files = useStore((s) => s.files);
  const syncing = useStore((s) => s.syncing);

  const staged = files.filter((f) => f.staged);
  const gitStaged = staged.filter((f) => f.store === "git").length;
  const bucketStaged = staged.filter((f) => f.store === "bucket").length;

  return (
    <div
      style={{
        width: "var(--inspector-w)",
        flex: "none",
        borderLeft: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
      }}
    >
      {sel && (
        <div style={{ padding: 16, borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={extChip(sel.path)}>{(extOf(sel.path) || "∙").slice(0, 3)}</span>
            <span style={badge(sel.state)}>
              <span style={{ fontSize: 8, lineHeight: 1 }}>{STATUS[sel.state].glyph}</span>
              {STATUS[sel.state].text}
            </span>
          </div>
          <div className="selectable" style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.4, fontFamily: "var(--font-mono)", color: "var(--text-body)", wordBreak: "break-all" }}>
            {sel.path}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <span style={storeChip(sel.store)}>{sel.store === "bucket" ? "BUCKET · R2" : "GIT"}</span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", alignSelf: "center" }}>{sel.size}</span>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: "var(--radius-md)",
              background: "var(--surface-sunken)",
              border: "1px solid var(--hairline)",
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-muted)",
            }}
          >
            {sel.store === "bucket"
              ? "This blob never touches Lockstep’s server — it streams straight to your bucket via a presigned PUT. Needs a lock to edit."
              : "Small text file — versioned in git like normal, optimistic merge. No lock needed."}
          </div>
          {sel.state === "locked" && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={sel.owner || "?"} size={24} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Locked by {sel.owner}
                {sel.age ? ` · ${sel.age}` : ""}
              </span>
            </div>
          )}
          {(sel.state === "modified" || sel.state === "conflict") && (
            <button
              onClick={() => void openDiff(sel)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                width: "100%",
                height: 36,
                marginTop: 12,
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                border: "1px solid var(--border-default)",
                background: "var(--surface-raised)",
                color: "var(--text-body)",
                boxShadow: "var(--shadow-edge)",
              }}
            >
              <Icon name="file-diff" size={14} />
              View diff
            </button>
          )}
          <button
            onClick={() => lockToEdit(sel.path)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              width: "100%",
              height: 36,
              marginTop: 14,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              border: sel.state === "mine" ? "1px solid var(--border-default)" : "1px solid transparent",
              background: sel.state === "mine" ? "var(--surface-raised)" : "var(--brand)",
              color: sel.state === "mine" ? "var(--text-body)" : "var(--brand-contrast)",
              boxShadow: sel.state === "mine" ? "var(--shadow-edge)" : "var(--glow-amber)",
            }}
          >
            <Icon name={sel.state === "mine" ? "unlock" : "lock"} size={14} />
            {sel.state === "mine" ? "Release lock" : sel.state === "locked" ? "Request lock" : "Lock to edit"}
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }} />

      <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          Commit &amp; submit
        </div>
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Summary of this change…"
          rows={3}
          className="selectable"
          style={{
            width: "100%",
            resize: "none",
            border: "1px solid var(--border-default)",
            background: "var(--surface-sunken)",
            borderRadius: "var(--radius-md)",
            padding: 10,
            color: "var(--text-body)",
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: "var(--font-sans)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 2 }}>
          <button
            onClick={toggleRelease}
            style={{
              width: 38,
              height: 22,
              flex: "none",
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              padding: 2,
              display: "flex",
              background: releaseLocks ? "var(--amber-400)" : "var(--ink-700)",
              justifyContent: releaseLocks ? "flex-end" : "flex-start",
              transition: "background .15s",
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: releaseLocks ? "var(--brand-contrast)" : "var(--slate-300)", display: "block" }} />
          </button>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontWeight: 500, fontSize: 13, color: "var(--text-body)" }}>Release my locks after submit</span>
            <span style={{ display: "block", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 1 }}>
              {releaseLocks ? "others can edit right after" : "you keep editing after submit"}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "0 2px" }}>
          <span>
            <span style={{ color: "var(--status-synced)" }}>git</span> {gitStaged} file{gitStaged === 1 ? "" : "s"}
          </span>
          <span>
            <span style={{ color: "var(--amber-400)" }}>bucket</span> {bucketStaged} blob{bucketStaged === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={() => startSync()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            width: "100%",
            height: 38,
            borderRadius: "var(--radius-md)",
            border: "1px solid transparent",
            background: "var(--brand)",
            color: "var(--brand-contrast)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "var(--glow-amber)",
          }}
        >
          <Icon name="git-commit-horizontal" size={16} />
          {syncing ? "Submitting…" : `Submit${staged.length ? " " + staged.length : ""}`}
        </button>
      </div>
    </div>
  );
}
