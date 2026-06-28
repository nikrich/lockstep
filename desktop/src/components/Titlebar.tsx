// Custom titlebar (the window is decoration-less). The traffic-light dots double
// as real window controls; the center shows repo / branch; the right shows
// connectivity + a Sync button.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";
import logoMark from "../assets/logo-mark.svg";

const appWindow = getCurrentWindow();

function Dot({ color, onClick, title }: { color: string; onClick: () => void; title: string }) {
  return (
    <span
      title={title}
      onClick={onClick}
      style={{ width: 12, height: 12, borderRadius: "50%", background: color, cursor: "pointer" }}
    />
  );
}

export function Titlebar() {
  const repoSlug = useStore((s) => s.settings.repoSlug);
  const branch = useStore((s) => s.branch);
  const online = useStore((s) => s.online);
  const syncing = useStore((s) => s.syncing);
  const refreshing = useStore((s) => s.refreshing);
  const startSync = useStore((s) => s.startSync);
  const refresh = useStore((s) => s.refresh);

  const name = repoSlug || "aurora-rpg";
  const busy = syncing || refreshing;

  return (
    <div
      data-tauri-drag-region
      className="no-select"
      style={{
        height: 38,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px",
        background: "var(--ink-950)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Dot color="#ff5f57" title="Close" onClick={() => appWindow.close()} />
        <Dot color="#febc2e" title="Minimize" onClick={() => appWindow.minimize()} />
        <Dot color="#28c840" title="Maximize" onClick={() => appWindow.toggleMaximize()} />
      </div>
      <div
        data-tauri-drag-region
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <img src={logoMark} height={18} alt="" />
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>{name}</span>
        <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>/</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontWeight: 500,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            fontStyle: branch ? "normal" : "italic",
            opacity: branch ? 1 : 0.7,
          }}
        >
          <Icon name="git-branch" size={12} />
          {branch || "no clone linked"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: online ? "var(--status-synced)" : "var(--status-conflict)",
              boxShadow: `0 0 7px ${online ? "var(--status-synced)" : "var(--status-conflict)"}`,
            }}
          />
          {online ? "online" : "offline"}
        </span>
        <button
          onClick={() => (busy ? refresh() : startSync())}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 24,
            padding: "0 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
            background: "var(--surface-raised)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <span className={busy ? "ls-spin" : ""} style={{ display: "inline-flex" }}>
            <Icon name="refresh-cw" size={12} />
          </span>
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>
    </div>
  );
}
