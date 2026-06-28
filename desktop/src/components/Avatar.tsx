// Initials avatar tinted deterministically from the name (matches the design's
// avStyle helper).
import { initials, tintFor } from "../lib/files";

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  // "You" gets a stable blue tint to read as self, like the design.
  const tintKey = name === "You" ? "You Me" : name;
  const t = tintFor(tintKey);
  const label = name === "You" ? "Y" : initials(name);
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        background: `color-mix(in srgb, ${t} 26%, var(--ink-800))`,
        color: t,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        fontFamily: "var(--font-sans)",
        textTransform: "uppercase",
        border: `1px solid color-mix(in srgb, ${t} 35%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
