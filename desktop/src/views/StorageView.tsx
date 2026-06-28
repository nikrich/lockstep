// Storage view: the cost story, derived from REAL bucket usage. Stored bytes,
// blob count and active locks come straight from the API; the monthly-cost
// estimate and the Git-LFS comparison are computed from those real bytes using
// each provider's published storage rate (clearly labelled "est."), not fixed
// marketing numbers.
import { useStore } from "../lib/store";
import { humanSize } from "../lib/files";
import { Icon } from "../components/Icon";

// Published storage rates, USD per GB-month.
const PROVIDER_RATE: Record<string, number> = {
  r2: 0.015,
  cloudflare: 0.015,
  "cloudflare r2": 0.015,
  b2: 0.006,
  backblaze: 0.006,
  s3: 0.023,
  aws: 0.023,
  wasabi: 0.0069,
  minio: 0.015,
};
// GitHub Git LFS data packs: ~$0.10/GB storage + ~$0.10/GB egress per month.
// An active team re-pulls roughly its working set monthly, so blended ≈ $0.20/GB.
const LFS_BLENDED_RATE = 0.2;
const B2_RATE = 0.006;

function rateFor(provider: string): number {
  const key = provider.trim().toLowerCase();
  return PROVIDER_RATE[key] ?? 0.015;
}

function money(v: number): string {
  if (v <= 0) return "$0";
  if (v < 10) return `$${v.toFixed(2)}`;
  if (v < 1000) return `$${Math.round(v)}`;
  return `$${(v / 1000).toFixed(1)}k`;
}

function Stat({
  label,
  value,
  unit,
  sub,
  subColor,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  subColor: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: `1px solid ${highlight ? "var(--amber-400)" : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-lg)",
        padding: 16,
        boxShadow: highlight ? "var(--glow-amber)" : "var(--shadow-edge)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
        {label}
      </div>
      <div style={{ marginTop: 10, fontFamily: "var(--font-mono)" }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: highlight ? "var(--amber-400)" : "var(--text-strong)" }}>{value}</span>
        {unit && <span style={{ fontSize: 15, color: "var(--text-muted)" }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: subColor, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

export function StorageView() {
  const storage = useStore((s) => s.storage);
  const files = useStore((s) => s.files);
  const provider = storage?.provider || "Cloudflare R2";
  const bucket = storage?.bucket || "—";

  const bytes = storage?.bytes;
  const haveUsage = bytes != null && bytes > 0;
  const gb = haveUsage ? bytes! / 1024 ** 3 : 100; // 100 GB example when usage unknown

  const rate = rateFor(provider);
  const lockstepCost = gb * rate;
  const lfsCost = gb * LFS_BLENDED_RATE;
  const b2Cost = gb * B2_RATE;
  const savingsPct = lfsCost > 0 ? Math.round((1 - lockstepCost / lfsCost) * 100) : 0;

  const stored = haveUsage ? humanSize(bytes!) : "—";
  const objects = storage?.objects != null ? `${storage.objects.toLocaleString()} blobs` : "no blobs yet";
  const activeLocks = files.filter((f) => f.state === "locked" || f.state === "mine").length;
  const stale = files.filter((f) => f.stale).length;

  const providerShort = provider.toLowerCase().includes("b2") || provider.toLowerCase().includes("backblaze") ? "B2" : provider.toLowerCase().includes("r2") || provider.toLowerCase().includes("cloud") ? "R2" : provider;

  const bars = [
    { label: "GitHub Git LFS", val: lfsCost, color: "var(--status-conflict)" },
    { label: `Lockstep + ${providerShort}`, val: lockstepCost, color: "var(--amber-400)" },
    { label: "Lockstep + B2", val: b2Cost, color: "var(--status-synced)" },
  ];
  const maxBar = Math.max(...bars.map((b) => b.val), 0.01);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>Storage</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
            {provider} · {bucket}
          </div>
        </div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 13px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-body)", cursor: "pointer", fontWeight: 600, fontSize: 12, boxShadow: "var(--shadow-edge)" }}>
          <Icon name="external-link" size={14} />
          Open bucket
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <Stat
            label="Est. monthly cost"
            value={money(lockstepCost)}
            unit="/mo"
            sub={haveUsage ? `≈ −${savingsPct}% vs Git LFS` : "example · connect storage"}
            subColor="var(--status-synced)"
            highlight
          />
          <Stat label="Egress billed" value="$0" sub="bytes skip the server" subColor="var(--text-muted)" />
          <Stat label="Stored" value={stored} sub={objects} subColor="var(--text-muted)" />
          <Stat label="Active locks" value={String(activeLocks)} sub={stale ? `${stale} stale` : "all fresh"} subColor={stale ? "var(--amber-300)" : "var(--text-muted)"} />
        </div>

        <div style={{ marginTop: 16, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "var(--shadow-edge)" }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>Cost vs hosted Git LFS</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", margin: "4px 0 18px" }}>
            {haveUsage ? `${stored} stored · est. / month` : "100 GB example · est. / month"}
          </div>
          {bars.map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <span style={{ width: 160, flex: "none", fontWeight: 500, fontSize: 13, color: "var(--text-secondary)" }}>{b.label}</span>
              <div style={{ flex: 1, height: 22, background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", borderRadius: "var(--radius-sm)", background: b.color, width: `${Math.max(2, (b.val / maxBar) * 100)}%`, minWidth: 8 }} />
              </div>
              <span style={{ width: 84, flex: "none", textAlign: "right", fontWeight: 600, fontSize: 13, fontFamily: "var(--font-mono)", color: b.color }}>{money(b.val)}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 6 }}>
            Estimate from your stored size at each provider’s published rate · Git LFS ≈ $0.20/GB blended (storage + egress).
          </div>
        </div>
      </div>
    </div>
  );
}
