// Team-wide lock table. Shows every active lock, surfaces stale locks (TTL with
// no heartbeat), lets admins force-release, and demonstrates OFPA per-actor
// granularity for World Partition maps.
import type { CSSProperties } from "react";
import { useStore } from "../lib/store";
import type { RepoFile } from "../lib/types";
import { splitPath } from "../lib/files";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";

const GRID = "minmax(0,1fr) 150px 158px 104px";

const OFPA = [
  { actor: "UpperRing_Cover_3F2A", owner: "You", age: "12m" },
  { actor: "SpawnVolume_Blue_9C1", owner: "You", age: "12m" },
  { actor: "Lighting_Sky_7B2E", owner: "Theo Park", age: "48m" },
  { actor: "Nav_Bounds_DA04", owner: "Kai Renner", age: "1h 12m" },
];

function actionStyle(kind: "ghost" | "danger"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 30,
    padding: "0 12px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
    border: kind === "danger" ? "1px solid var(--border-strong)" : "1px solid var(--border-strong)",
    background: kind === "danger" ? "color-mix(in srgb, var(--status-conflict) 16%, transparent)" : "transparent",
    color: kind === "danger" ? "var(--status-conflict)" : "var(--text-body)",
  };
}

export function TeamLocksView() {
  const files = useStore((s) => s.files);
  const scope = useStore((s) => s.locksScope);
  const setScope = useStore((s) => s.setLocksScope);
  const lockToEdit = useStore((s) => s.lockToEdit);
  const forceRelease = useStore((s) => s.forceRelease);

  const locked = files.filter((f) => f.state === "mine" || f.state === "locked");
  const scoped = locked.filter((l) => (scope === "mine" ? l.state === "mine" : scope === "stale" ? l.stale : true));

  const total = locked.length;
  const stale = locked.filter((l) => l.stale).length;
  const mine = locked.filter((l) => l.state === "mine").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>Team locks</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
            {total} active · {stale} stale · {mine} yours
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--surface-sunken)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)" }}>
          {(["all", "mine", "stale"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setScope(v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 28,
                padding: "0 14px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
                borderRadius: "var(--radius-sm)",
                background: scope === v ? "var(--surface-raised)" : "transparent",
                color: scope === v ? "var(--text-strong)" : "var(--text-muted)",
                boxShadow: scope === v ? "var(--shadow-edge)" : "none",
                textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 18 }}>
        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)", boxShadow: "var(--shadow-edge)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 14,
              padding: "11px 18px",
              borderBottom: "1px solid var(--hairline)",
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
            }}
          >
            <span>File</span>
            <span>Holder</span>
            <span>Held · TTL</span>
            <span style={{ textAlign: "right" }}>Action</span>
          </div>

          {scoped.map((l) => (
            <LockRow key={l.path} l={l} onPrimary={() => (l.state === "mine" ? lockToEdit(l.path) : l.stale ? forceRelease(l.path) : lockToEdit(l.path))} />
          ))}

          {scoped.length === 0 && (
            <div style={{ padding: "26px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No locks in this view.</div>
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--status-mine) 7%, var(--surface-card))",
            border: "1px solid var(--hairline)",
          }}
        >
          <Icon name="info" size={15} color="var(--status-mine)" />
          <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
            OFPA splits a level into one file per actor, so several people can hold locks inside the same map at once. Admins
            can force-release a stale lock when a heartbeat hasn’t landed within the TTL.
          </span>
        </div>
      </div>
    </div>
  );
}

function LockRow({ l, onPrimary }: { l: RepoFile; onPrimary: () => void }) {
  const { dir, name } = splitPath(l.path);
  const mine = l.state === "mine";
  const isMap = name.endsWith(".umap");
  const actionLabel = mine ? "Release" : l.stale ? "Force release" : "Request";

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 14, alignItems: "center", padding: "13px 18px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: "var(--text-muted)" }}>{dir}</span>
            {name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{l.size}</span>
            {isMap && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, letterSpacing: ".04em", fontFamily: "var(--font-mono)", color: "var(--status-mine)", background: "var(--status-mine-bg)", padding: "2px 6px", borderRadius: "var(--radius-xs)" }}>
                OFPA · {OFPA.length} actors
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <Avatar name={l.owner || "?"} size={26} />
          <span style={{ fontWeight: 500, fontSize: 13, color: mine ? "var(--status-mine)" : l.stale ? "var(--status-conflict)" : "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.owner}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: l.stale ? "var(--status-conflict)" : "var(--text-muted)" }}>{l.age || "—"}</span>
            {l.stale && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--status-conflict)", background: "var(--status-conflict-bg)", padding: "2px 5px", borderRadius: "var(--radius-xs)" }}>
                stale
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 3 }}>
            {l.stale ? "TTL expired · no heartbeat" : "TTL 90s · heartbeat ok"}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onPrimary} style={actionStyle(l.stale && !mine ? "danger" : "ghost")}>
            {actionLabel}
          </button>
        </div>
      </div>

      {isMap &&
        OFPA.map((a) => (
          <div key={a.actor} style={{ display: "grid", gridTemplateColumns: GRID, gap: 14, alignItems: "center", padding: "9px 18px 9px 34px", borderBottom: "1px solid var(--hairline)", background: "var(--surface-sunken)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ width: 14, height: 1, background: "var(--border-strong)", flex: "none" }} />
              <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.actor}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={a.owner} size={20} />
              <span style={{ fontSize: 12, color: a.owner === "You" ? "var(--status-mine)" : "var(--text-secondary)" }}>{a.owner}</span>
            </div>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{a.age}</span>
            <span />
          </div>
        ))}
    </>
  );
}
