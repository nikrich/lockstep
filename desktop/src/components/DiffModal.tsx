// Full-screen unified-diff viewer for a changed file. Driven by store.diff,
// opened via openDiff(file) and closed with closeDiff() / Esc / backdrop click.
import { useEffect } from "react";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";

type DKind = "ctx" | "add" | "del" | "hunk";
interface DLine {
  kind: DKind;
  text: string;
  oldNo?: number;
  newNo?: number;
}

// Parse a git unified diff into renderable lines, tracking old/new line numbers.
function parseUnified(diff: string): DLine[] {
  const out: DLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of diff.split("\n")) {
    if (
      raw.startsWith("diff --git") ||
      raw.startsWith("index ") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ") ||
      raw.startsWith("new file") ||
      raw.startsWith("deleted file") ||
      raw.startsWith("old mode") ||
      raw.startsWith("new mode") ||
      raw.startsWith("similarity ") ||
      raw.startsWith("rename ")
    ) {
      continue; // file headers — the path is already in the modal title
    }
    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        oldNo = parseInt(m[1], 10);
        newNo = parseInt(m[2], 10);
      }
      out.push({ kind: "hunk", text: raw });
      continue;
    }
    if (raw.startsWith("\\")) continue; // "\ No newline at end of file"
    if (raw.startsWith("+")) {
      out.push({ kind: "add", text: raw.slice(1), newNo });
      newNo++;
    } else if (raw.startsWith("-")) {
      out.push({ kind: "del", text: raw.slice(1), oldNo });
      oldNo++;
    } else {
      out.push({ kind: "ctx", text: raw.startsWith(" ") ? raw.slice(1) : raw, oldNo, newNo });
      oldNo++;
      newNo++;
    }
  }
  // Drop a trailing empty context line from the final newline split.
  if (out.length && out[out.length - 1].kind === "ctx" && out[out.length - 1].text === "") out.pop();
  return out;
}

function gutter(n?: number) {
  return (
    <span
      style={{
        width: 48,
        flex: "none",
        textAlign: "right",
        paddingRight: 10,
        color: "var(--text-muted)",
        userSelect: "none",
        opacity: 0.7,
      }}
    >
      {n ?? ""}
    </span>
  );
}

export function DiffModal() {
  const diff = useStore((s) => s.diff);
  const close = useStore((s) => s.closeDiff);

  useEffect(() => {
    if (!diff) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [diff, close]);

  if (!diff) return null;

  const lines = diff.text ? parseUnified(diff.text) : [];
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;
  const name = diff.path.split(/[\\/]/).pop();
  const dir = diff.path.slice(0, diff.path.length - (name?.length ?? 0));
  const isBinary = diff.binary || diff.store === "bucket";

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "color-mix(in srgb, var(--ink-950) 72%, transparent)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        animation: "ls-fade .14s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 1080,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-pop, 0 24px 64px rgba(0,0,0,.5))",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--hairline)" }}>
          <Icon name="file-diff" size={16} color="var(--text-muted)" />
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontFamily: "var(--font-mono)", fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)" }}>{dir}</span>
            <span style={{ color: "var(--text-strong)", fontWeight: 600 }}>{name}</span>
          </div>
          {!isBinary && !diff.loading && !diff.error && (
            <span style={{ display: "flex", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12, flex: "none" }}>
              <span style={{ color: "var(--status-synced)" }}>+{added}</span>
              <span style={{ color: "var(--status-conflict)" }}>−{removed}</span>
            </span>
          )}
          <button
            onClick={close}
            title="Close (Esc)"
            style={{ width: 28, height: 28, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "var(--surface-card)", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--bg-app)" }}>
          {diff.loading ? (
            <Centered>
              <span className="ls-spin" style={{ display: "inline-flex" }}>
                <Icon name="loader" size={18} color="var(--amber-400)" />
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>Computing diff…</span>
            </Centered>
          ) : diff.error ? (
            <Centered>
              <Icon name="triangle-alert" size={20} color="var(--status-conflict)" />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{diff.error}</span>
            </Centered>
          ) : isBinary ? (
            <Centered>
              <Icon name="file-box" size={22} color="var(--amber-400)" />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Binary file — no text diff.{diff.store === "bucket" ? " This asset is versioned as a blob in your bucket." : ""}
              </span>
            </Centered>
          ) : lines.length === 0 ? (
            <Centered>
              <Icon name="check" size={20} color="var(--status-synced)" />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>No changes to show.</span>
            </Centered>
          ) : (
            <div style={{ font: "12px/1.55 var(--font-mono)", paddingBottom: 8 }}>
              {lines.map((l, i) => {
                if (l.kind === "hunk") {
                  return (
                    <div key={i} style={{ padding: "4px 14px", color: "var(--text-muted)", background: "var(--surface-sunken)", borderTop: i ? "1px solid var(--hairline)" : "none", borderBottom: "1px solid var(--hairline)", whiteSpace: "pre" }}>
                      {l.text}
                    </div>
                  );
                }
                const bg =
                  l.kind === "add"
                    ? "color-mix(in srgb, var(--status-synced) 13%, transparent)"
                    : l.kind === "del"
                      ? "color-mix(in srgb, var(--status-conflict) 13%, transparent)"
                      : "transparent";
                const sign = l.kind === "add" ? "+" : l.kind === "del" ? "−" : " ";
                const signColor = l.kind === "add" ? "var(--status-synced)" : l.kind === "del" ? "var(--status-conflict)" : "var(--text-muted)";
                return (
                  <div key={i} style={{ display: "flex", background: bg, minWidth: "min-content" }}>
                    {gutter(l.oldNo)}
                    {gutter(l.newNo)}
                    <span style={{ width: 16, flex: "none", textAlign: "center", color: signColor, userSelect: "none" }}>{sign}</span>
                    <span className="selectable" style={{ flex: 1, whiteSpace: "pre", paddingRight: 16, color: "var(--text-body)" }}>{l.text || " "}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: 200, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)", padding: 40, textAlign: "center" }}>
      {children}
    </div>
  );
}
