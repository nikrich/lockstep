// Lucide icon by kebab-case name (matching the design's `<ls-icon name="…">`).
import { icons, type LucideProps } from "lucide-react";

function toPascal(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

interface Props extends Omit<LucideProps, "ref"> {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 16, color = "currentColor", ...rest }: Props) {
  const key = toPascal(name) as keyof typeof icons;
  const Cmp = icons[key];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      color={color}
      strokeWidth={1.75}
      style={{ flex: "none", display: "inline-flex", ...rest.style }}
      {...rest}
    />
  );
}
