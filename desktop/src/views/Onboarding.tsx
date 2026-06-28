// First-run (and re-runnable) setup: browser OAuth sign-in → pick org → link a
// local clone. Drives the real auth + org selection in the store.
import { useStore } from "../lib/store";
import { Icon } from "../components/Icon";
import { credentialStoreName } from "../lib/platform";
import logoWordmark from "../assets/logo-wordmark.svg";

export function Onboarding() {
  const step = useStore((s) => s.onboardStep);
  const orgs = useStore((s) => s.orgs);
  const settings = useStore((s) => s.settings);
  const signingIn = useStore((s) => s.signingIn);
  const token = useStore((s) => s.token);
  const login = useStore((s) => s.login);
  const setOrg = useStore((s) => s.setOrg);
  const next = useStore((s) => s.onbNext);
  const back = useStore((s) => s.onbBack);
  const finish = useStore((s) => s.onbFinish);
  const pickLocalRepo = useStore((s) => s.pickLocalRepo);

  const steps = [
    { n: "01", label: "Sign in" },
    { n: "02", label: "Pick org" },
    { n: "03", label: "Clone" },
  ];

  return (
    <div style={{ position: "absolute", top: "var(--titlebar-h)", left: 0, right: 0, bottom: 0, zIndex: "var(--z-overlay)" as unknown as number, display: "flex", background: "var(--bg-app)" }}>
      {/* left rail */}
      <div style={{ width: 300, flex: "none", background: "var(--bg-panel)", borderRight: "1px solid var(--hairline)", padding: "36px 28px", display: "flex", flexDirection: "column" }}>
        <img src={logoWordmark} height={22} alt="Lockstep" />
        <div style={{ marginTop: 46, display: "flex", flexDirection: "column", gap: 22 }}>
          {steps.map((st, i) => (
            <div key={st.n} style={{ display: "flex", alignItems: "center", gap: 9, font: "600 12px/1 var(--font-mono)", color: step >= i ? "var(--text-strong)" : "var(--text-muted)" }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  flex: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  background: step > i ? "var(--amber-400)" : step === i ? "var(--status-mine-bg)" : "var(--surface-sunken)",
                  color: step > i ? "var(--brand-contrast)" : step === i ? "var(--status-mine)" : "var(--text-muted)",
                  border: `1px solid ${step === i ? "var(--status-mine)" : "transparent"}`,
                }}
              >
                {st.n}
              </span>
              {st.label}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: 14, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--hairline)", fontSize: 12, lineHeight: 1.55, color: "var(--text-muted)" }}>
          <span style={{ color: "var(--amber-300)", fontWeight: 600 }}>Your bucket, your bytes.</span> Blob data streams straight to storage you own — Lockstep only brokers presigned URLs.
        </div>
      </div>

      {/* right content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ width: "100%", maxWidth: 460, animation: "ls-fade .18s ease" }}>
            {step === 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: "-.02em", color: "var(--text-strong)" }}>Own your bytes.</div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: "var(--text-muted)", marginTop: 12 }}>
                  Keep code in git. Stream giant binary assets to a cloud bucket you control. Sign in to connect your studio.
                </div>
                <button
                  onClick={() => login()}
                  disabled={signingIn}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", height: 46, marginTop: 28, borderRadius: "var(--radius-md)", border: "1px solid transparent", background: "var(--brand)", color: "var(--brand-contrast)", cursor: signingIn ? "default" : "pointer", fontWeight: 600, fontSize: 15, boxShadow: "var(--glow-amber)", opacity: signingIn ? 0.7 : 1 }}
                >
                  <span className={signingIn ? "ls-spin" : ""} style={{ display: "inline-flex" }}>
                    <Icon name={signingIn ? "loader" : "globe"} size={18} />
                  </span>
                  {signingIn ? "Waiting for browser…" : "Continue with browser"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--hairline)" }}>
                  <Icon name="key-round" size={16} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
                    OAuth opens your browser, then a personal access token is stored in <span style={{ color: "var(--text-secondary)" }}>{credentialStoreName}</span> — never on disk in plaintext.
                  </span>
                </div>
                {token && (
                  <div style={{ marginTop: 14, fontSize: 12, color: "var(--status-synced)", fontFamily: "var(--font-mono)" }}>✓ Signed in — continue to pick your org.</div>
                )}
              </div>
            )}

            {step === 1 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: "-.02em", color: "var(--text-strong)" }}>Pick an organization</div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)", marginTop: 10 }}>You’re a billable seat in these orgs. Choose one to work in.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
                  {(orgs.length ? orgs : [{ id: "demo", name: "Aurora Studio", slug: "aurora", role: "member" as const, seats: 5 }]).map((o) => {
                    const active = settings.orgId === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setOrg(o.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 14, borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left", background: active ? "var(--status-mine-bg)" : "var(--surface-sunken)", border: `1px solid ${active ? "var(--status-mine)" : "var(--hairline)"}` }}
                      >
                        <span style={{ width: 18, height: 18, borderRadius: "50%", flex: "none", border: `2px solid ${active ? "var(--status-mine)" : "var(--border-strong)"}`, background: active ? "var(--status-mine)" : "transparent", boxShadow: active ? "inset 0 0 0 3px var(--surface-sunken)" : "none" }} />
                        <span style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", flex: "none", background: "color-mix(in srgb, var(--amber-400) 16%, var(--ink-800))", color: "var(--amber-400)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name="building-2" size={18} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>{o.name}</span>
                          <span style={{ display: "block", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
                            {o.seats} {o.seats === 1 ? "seat" : "seats"} · {o.role} · billable seat
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: "-.02em", color: "var(--text-strong)" }}>Link your clone</div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)", marginTop: 10 }}>
                  Code comes from git. Binary blobs stream from the bucket you own — nothing routes through Lockstep.
                </div>
                <div style={{ marginTop: 22 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 7 }}>Local path</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, height: 42, padding: "0 12px", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-default)" }}>
                    <Icon name="folder" size={16} color="var(--text-muted)" />
                    <span className="selectable" style={{ flex: 1, fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {settings.localPath || "~/dev/aurora-rpg"}
                    </span>
                    <span onClick={pickLocalRepo} style={{ fontSize: 12, fontWeight: 600, color: "var(--status-mine)", cursor: "pointer" }}>
                      Browse
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 11, padding: 14, borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--amber-400) 7%, var(--surface-card))", border: "1px solid color-mix(in srgb, var(--amber-400) 22%, var(--hairline))" }}>
                  <span style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", flex: "none", background: "var(--status-locked-bg)", color: "var(--amber-400)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="hard-drive" size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>Cloudflare R2 · your bucket</div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 3 }}>your bucket · $0 egress · presigned PUT/GET</div>
                  </div>
                  <span style={{ alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--status-synced)" }}>
                    <Icon name="circle-check" size={14} />
                    linked
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "16px 40px", borderTop: "1px solid var(--hairline)" }}>
          <button
            onClick={back}
            style={{ height: 38, padding: "0 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-body)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
          >
            Back
          </button>
          <span style={{ flex: 1 }} />
          {step < 2 ? (
            <button
              onClick={next}
              disabled={step === 0 && !token}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 20px", borderRadius: "var(--radius-md)", border: "1px solid transparent", background: "var(--brand)", color: "var(--brand-contrast)", cursor: step === 0 && !token ? "default" : "pointer", fontWeight: 600, fontSize: 14, boxShadow: "var(--glow-amber)", opacity: step === 0 && !token ? 0.5 : 1 }}
            >
              Continue
              <Icon name="arrow-right" size={16} />
            </button>
          ) : (
            <button
              onClick={() => finish()}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 20px", borderRadius: "var(--radius-md)", border: "1px solid transparent", background: "var(--brand)", color: "var(--brand-contrast)", cursor: "pointer", fontWeight: 600, fontSize: 14, boxShadow: "var(--glow-amber)" }}
            >
              <Icon name="download" size={16} />
              Open workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
