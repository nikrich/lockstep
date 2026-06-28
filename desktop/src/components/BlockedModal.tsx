// "You don't hold this lock" dialog — shown when you try to edit a binary that
// someone else has locked (and soft-lock mode is off).
import { useStore } from "../lib/store";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

export function BlockedModal() {
  const blocked = useStore((s) => s.blocked);
  const dismiss = useStore((s) => s.dismissBlocked);
  const requestLock = useStore((s) => s.requestLock);
  if (!blocked) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: "var(--z-dialog)" as unknown as number,
        background: "rgba(5,8,11,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "ls-fade .15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          background: "var(--surface-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          animation: "ls-rise .18s ease",
        }}
      >
        <div style={{ display: "flex", gap: 14, padding: "18px 18px 0" }}>
          <span
            style={{
              width: 40,
              height: 40,
              flex: "none",
              borderRadius: "var(--radius-md)",
              background: "var(--status-locked-bg)",
              color: "var(--amber-400)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="lock" size={20} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>
              You don’t hold this lock
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 4 }}>
              This is an unmergeable binary. It’s read-only on disk until the current holder releases
              the lock. Ask them, or request it below.
            </div>
          </div>
        </div>
        <div
          style={{
            margin: "16px 18px",
            padding: "11px 13px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface-sunken)",
            border: "1px solid var(--hairline)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Avatar name={blocked.owner} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="selectable"
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--text-body)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {blocked.path}
            </div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
              held by {blocked.owner} · {blocked.age}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, padding: "0 18px 18px" }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1,
              height: 36,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--text-body)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={requestLock}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              height: 36,
              borderRadius: "var(--radius-md)",
              border: "1px solid transparent",
              background: "var(--brand)",
              color: "var(--brand-contrast)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              boxShadow: "var(--glow-amber)",
            }}
          >
            <Icon name="mail" size={14} />
            Request lock
          </button>
        </div>
      </div>
    </div>
  );
}
