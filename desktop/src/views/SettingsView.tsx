// Settings: locking behaviour toggles (incl. the soft-lock advisory mode from
// the architecture doc), the linked local clone, and the signed-in account.
import { useStore } from "../lib/store";
import { Icon } from "../components/Icon";
import { credentialStoreName } from "../lib/platform";

interface Row {
  key: "softLock" | "autoLock" | "offlineGrace" | "notifyRequests";
  title: string;
  desc: string;
  warn?: boolean;
}

const ROWS: Row[] = [
  {
    key: "softLock",
    title: "Soft-lock advisory mode",
    desc: "Locks become advisory — editing a file held by someone else warns instead of blocking. Use only if your team trusts coordination over enforcement.",
    warn: true,
  },
  {
    key: "autoLock",
    title: "Auto-lock on edit",
    desc: "Acquire the lock automatically the moment you modify a lockable binary in the editor.",
  },
  {
    key: "offlineGrace",
    title: "Offline grace period",
    desc: "Keep held locks alive for 10 minutes without a heartbeat when you drop offline, instead of releasing immediately.",
  },
  {
    key: "notifyRequests",
    title: "Notify on lock requests",
    desc: "Get a desktop notification when a teammate requests a file you currently hold.",
  },
];

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40,
        height: 23,
        flex: "none",
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        padding: 2,
        display: "flex",
        background: on ? "var(--amber-400)" : "var(--ink-700)",
        justifyContent: on ? "flex-end" : "flex-start",
        transition: "background .15s",
      }}
    >
      <span style={{ width: 19, height: 19, borderRadius: "50%", background: on ? "var(--brand-contrast)" : "var(--slate-300)", display: "block" }} />
    </button>
  );
}

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const toggle = useStore((s) => s.toggleSetting);
  const user = useStore((s) => s.user);
  const orgs = useStore((s) => s.orgs);
  const logout = useStore((s) => s.logout);
  const pickLocalRepo = useStore((s) => s.pickLocalRepo);

  const orgId = settings.orgId;
  const org = orgs.find((o) => o.id === orgId);
  const email = user?.email || user?.name || "you@aurora.studio";
  const role = org?.role || "member";
  const orgName = org?.name || "Aurora Studio";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", padding: "0 18px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>Settings</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>Locking · sync · account</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 22 }}>
        <div style={{ maxWidth: 680 }}>
          <SectionLabel>Locking</SectionLabel>
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)", boxShadow: "var(--shadow-edge)" }}>
            {ROWS.map((r) => (
              <div key={r.key} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "16px 18px", borderBottom: "1px solid var(--hairline)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>{r.title}</span>
                    {r.warn && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--amber-300)", background: "var(--status-locked-bg)", padding: "2px 6px", borderRadius: "var(--radius-xs)" }}>
                        advanced
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 4 }}>{r.desc}</div>
                </div>
                <Switch on={!!settings[r.key]} onClick={() => toggle(r.key)} />
              </div>
            ))}
          </div>

          <SectionLabel style={{ marginTop: 24 }}>Local clone</SectionLabel>
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", boxShadow: "var(--shadow-edge)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 38, height: 38, borderRadius: "var(--radius-md)", flex: "none", background: "var(--status-locked-bg)", color: "var(--amber-400)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="folder-git-2" size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>{settings.localPath ? "Working copy linked" : "No local clone linked"}</div>
              <div className="selectable" style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {settings.localPath || "Link a folder to see real changes & submit"}
              </div>
            </div>
            <button
              onClick={pickLocalRepo}
              style={{ height: 32, padding: "0 13px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-body)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}
            >
              {settings.localPath ? "Change" : "Link folder"}
            </button>
          </div>

          <SectionLabel style={{ marginTop: 24 }}>Account</SectionLabel>
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", boxShadow: "var(--shadow-edge)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 38, height: 38, borderRadius: "50%", flex: "none", background: "color-mix(in srgb, var(--status-mine) 26%, var(--ink-800))", color: "var(--status-mine)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, border: "1px solid color-mix(in srgb, var(--status-mine) 35%, transparent)" }}>
              {email[0]?.toUpperCase() || "Y"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="selectable" style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>{email}</div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
                {orgName} · {role} · billable seat · PAT in {credentialStoreName}
              </div>
            </div>
            <button
              onClick={() => logout()}
              style={{ height: 32, padding: "0 13px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-body)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: ".07em",
        textTransform: "uppercase",
        fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
