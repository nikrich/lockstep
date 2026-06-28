// Commit timeline. Pulls real commits from the linked local clone (git log);
// falls back to a representative timeline when no clone is wired up.
import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import * as native from "../lib/native";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";

interface Item {
  hash: string;
  author: string;
  message: string;
  when: string;
  files: number;
}

const DEMO: Item[] = [
  { message: "Block out arena upper ring + cover", author: "You", hash: "9f2ac01", when: "14m ago", files: 4 },
  { message: "Hero idle + run anim retarget", author: "Mara Voss", hash: "3b71e0d", when: "2h ago", files: 11 },
  { message: "Lock heartbeat TTL → 90s", author: "Kai Renner", hash: "c014b8a", when: "5h ago", files: 2 },
  { message: "Explosion VFX pass, new flipbook", author: "Theo Park", hash: "d9f3120", when: "Yesterday", files: 6 },
  { message: "Presigned PUT for multipart blobs", author: "Kai Renner", hash: "77a9e41", when: "Yesterday", files: 3 },
  { message: "Initial bucket migration from Git LFS", author: "Juno Sandak", hash: "1c0bb02", when: "3 days ago", files: 212 },
];

export function HistoryView() {
  const localPath = useStore((s) => s.settings.localPath);
  const branch = useStore((s) => s.branch);
  // With a linked clone we load the real log and show a loader meanwhile (no
  // mock-data flash). With no clone there's nothing to fetch, so the sample
  // timeline stands in as the explorable placeholder.
  const [items, setItems] = useState<Item[]>(localPath ? [] : DEMO);
  const [loading, setLoading] = useState<boolean>(!!localPath);

  useEffect(() => {
    if (!localPath) {
      setItems(DEMO);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    native
      .gitLog(localPath, 40)
      .then((commits) => {
        if (!alive) return;
        setItems(
          commits.map((c) => ({ hash: c.hash, author: c.author, message: c.message, when: c.when, files: c.files })),
        );
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [localPath]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", padding: "0 18px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>History</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>{branch}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px" }}>
        {loading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
            <span className="ls-spin" style={{ display: "inline-flex" }}>
              <Icon name="loader" size={16} color="var(--amber-400)" />
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>Reading history…</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No commits yet on this branch.
          </div>
        ) : (
          items.map((c, i) => (
          <div key={c.hash + i} style={{ display: "flex", gap: 15, padding: "13px 4px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Avatar name={c.author === "You" ? "You" : c.author} size={28} />
              {i < items.length - 1 && <span style={{ flex: 1, width: 2, background: "var(--hairline)", marginTop: 6 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 6, borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text-strong)" }}>{c.message}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 5, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{c.author}</span>
                <span style={{ color: "var(--status-mine)" }}>{c.hash}</span>
                <span>{c.when}</span>
                <span>· {c.files} files</span>
              </div>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
}
