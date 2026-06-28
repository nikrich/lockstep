// Left rail: repo switcher, workspace nav, team avatars, settings/onboard.
import { useStore } from "../lib/store";
import type { ViewKey } from "../lib/types";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

interface NavDef {
  key: ViewKey;
  label: string;
  icon: string;
  count?: number;
}

export function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const files = useStore((s) => s.files);
  const team = useStore((s) => s.team);
  const repoSlug = useStore((s) => s.settings.repoSlug);
  const provider = useStore((s) => s.storage?.provider);

  const changed = files.filter((f) => f.state === "modified" || f.state === "conflict").length;
  const mine = files.filter((f) => f.state === "mine").length;
  const allLocks = files.filter((f) => f.state === "locked" || f.state === "mine").length;

  const nav: NavDef[] = [
    { key: "repo", label: "Repository", icon: "folder-git-2", count: changed + mine },
    { key: "locks", label: "Team locks", icon: "lock", count: allLocks },
    { key: "history", label: "History", icon: "history" },
    { key: "storage", label: "Storage", icon: "hard-drive" },
  ];

  return (
    <div
      style={{
        width: "var(--sidebar-w)",
        flex: "none",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
        borderRight: "1px solid var(--hairline)",
      }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid var(--hairline)" }}>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            height: 44,
            padding: "0 10px",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            background: "var(--surface-card)",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "var(--radius-sm)",
              background: "color-mix(in srgb, var(--amber-400) 18%, var(--ink-800))",
              color: "var(--amber-400)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <Icon name="box" size={15} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>
              {repoSlug || "aurora-rpg"}
            </span>
            <span
              style={{
                display: "block",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
              }}
            >
              {provider || "Cloudflare R2"}
            </span>
          </span>
          <Icon name="chevrons-up-down" size={14} color="var(--text-muted)" />
        </button>
      </div>

      <div style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "8px 10px 6px",
            fontFamily: "var(--font-mono)",
          }}
        >
          Workspace
        </div>
        {nav.map((n) => {
          const active = view === n.key;
          return (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                height: 34,
                padding: "0 10px",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: active ? "var(--surface-raised)" : "transparent",
                color: active ? "var(--text-strong)" : "var(--text-secondary)",
                fontWeight: active ? 600 : 500,
                fontSize: 14,
                boxShadow: active ? "var(--shadow-edge)" : "none",
              }}
            >
              <Icon name={n.icon} size={17} color={active ? "var(--amber-400)" : "var(--text-muted)"} />
              <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>
              {n.count !== undefined && n.count > 0 && (
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: active ? "var(--amber-300)" : "var(--text-muted)",
                    background: active ? "var(--status-locked-bg)" : "rgba(255,255,255,0.05)",
                    padding: "3px 6px",
                    borderRadius: "var(--radius-pill)",
                  }}
                >
                  {n.count}
                </span>
              )}
            </button>
          );
        })}

        <div
          style={{
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "16px 10px 6px",
            fontFamily: "var(--font-mono)",
          }}
        >
          Team · {team.length}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 10px" }}>
          {team.map((m) => (
            <Avatar key={m} name={m === "You" ? "You" : m} size={28} />
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 10,
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          onClick={() => setView("settings")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: 1,
            height: 34,
            padding: "0 10px",
            border: "none",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            background: view === "settings" ? "var(--surface-raised)" : "transparent",
            color: view === "settings" ? "var(--text-strong)" : "var(--text-secondary)",
            fontWeight: view === "settings" ? 600 : 500,
            fontSize: 14,
          }}
        >
          <Icon name="settings" size={16} color={view === "settings" ? "var(--amber-400)" : "var(--text-muted)"} />
          <span style={{ flex: 1, textAlign: "left" }}>Settings</span>
        </button>
        <button
          onClick={() => setView("onboarding")}
          title="Replay first-run setup"
          style={{
            width: 34,
            height: 34,
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border-default)",
            background: "var(--surface-card)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <Icon name="rocket" size={15} />
        </button>
      </div>
    </div>
  );
}
