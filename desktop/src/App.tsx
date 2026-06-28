import { useEffect } from "react";
import { useStore } from "./lib/store";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { BlockedModal } from "./components/BlockedModal";
import { DiffModal } from "./components/DiffModal";
import { RepositoryView } from "./views/RepositoryView";
import { TeamLocksView } from "./views/TeamLocksView";
import { HistoryView } from "./views/HistoryView";
import { StorageView } from "./views/StorageView";
import { SettingsView } from "./views/SettingsView";
import { Onboarding } from "./views/Onboarding";
import { Icon } from "./components/Icon";

export default function App() {
  const ready = useStore((s) => s.ready);
  const view = useStore((s) => s.view);
  const init = useStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  // Auto-refresh the working copy so on-disk edits show up without a manual Sync:
  // instantly when the window regains focus (you edited in your editor and tabbed
  // back), plus a gentle background poll as a safety net. Both run silently.
  useEffect(() => {
    if (!ready || view === "onboarding") return;
    const refreshNow = () => {
      const s = useStore.getState();
      if (!s.syncing && !s.refreshing) void s.refresh(true);
    };
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
      getCurrentWindow()
        .onFocusChanged(({ payload: focused }) => {
          if (focused) refreshNow();
        })
        .then((u) => {
          unlisten = u;
        }),
    );
    const id = setInterval(refreshNow, 8000);
    return () => {
      clearInterval(id);
      unlisten?.();
    };
  }, [ready, view]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-app)",
        color: "var(--text-body)",
        position: "relative",
      }}
    >
      <Titlebar />

      {!ready ? (
        <Splash />
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <Sidebar />
          <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
            {view === "repo" && <RepositoryView />}
            {view === "locks" && <TeamLocksView />}
            {view === "history" && <HistoryView />}
            {view === "storage" && <StorageView />}
            {view === "settings" && <SettingsView />}
          </div>
        </div>
      )}

      {ready && view === "onboarding" && <Onboarding />}

      <BlockedModal />
      <DiffModal />
      <Toast />
    </div>
  );
}

function Splash() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: 10 }}>
      <span className="ls-spin" style={{ display: "inline-flex" }}>
        <Icon name="loader" size={18} color="var(--amber-400)" />
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>Starting Lockstep…</span>
    </div>
  );
}
