import { useStore } from "../lib/store";
import { Icon } from "./Icon";

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "var(--z-toast)" as unknown as number,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 16px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-raised)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-lg)",
        animation: "ls-rise .18s ease",
      }}
    >
      <Icon name={toast.icon} size={16} color={toast.color} />
      <span style={{ fontSize: 13, color: "var(--text-body)" }}>{toast.msg}</span>
    </div>
  );
}
