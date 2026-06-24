// Polar (Merchant of Record) integration: hosted checkout, a customer-portal
// link, and Standard Webhooks signature verification.
//
// Polar is the seller of record, so it collects + remits global tax and owns
// the card + invoices. Lockstep only mirrors subscription state (via webhooks)
// and sends customers to Polar's hosted checkout/portal.
import type { Env } from "./types";
import { timingSafeEqual } from "./crypto";

function apiBase(env: Env): string {
  return (env.POLAR_SERVER || "sandbox") === "production"
    ? "https://api.polar.sh"
    : "https://sandbox-api.polar.sh";
}

export function billingConfigured(env: Env): boolean {
  return !!(env.POLAR_ACCESS_TOKEN && env.POLAR_PRODUCT_ID);
}

interface CheckoutOpts {
  orgId: string;
  email?: string | null;
  seats?: number;
  successUrl: string;
}

/** Create a hosted checkout session; returns the URL to send the buyer to. */
export async function createCheckout(env: Env, opts: CheckoutOpts): Promise<{ url: string; id: string }> {
  if (!billingConfigured(env)) throw new Error("billing is not configured");

  const body: Record<string, unknown> = {
    products: [env.POLAR_PRODUCT_ID],
    success_url: opts.successUrl,
    metadata: { org_id: opts.orgId },
  };
  if (opts.email) body.customer_email = opts.email;
  if (opts.seats && opts.seats > 0) body.seats = Math.min(1000, Math.max(1, opts.seats));

  const res = await fetch(`${apiBase(env)}/v1/checkouts/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`polar checkout failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { id: string; url: string };
  return { url: j.url, id: j.id };
}

/** Create a customer-portal session so a customer can manage card + invoices. */
export async function createPortalSession(env: Env, customerId: string): Promise<string> {
  if (!env.POLAR_ACCESS_TOKEN) throw new Error("billing is not configured");
  const res = await fetch(`${apiBase(env)}/v1/customer-sessions/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: customerId }),
  });
  if (!res.ok) throw new Error(`polar portal failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { customer_portal_url?: string };
  if (!j.customer_portal_url) throw new Error("no portal url returned");
  return j.customer_portal_url;
}

// --- Standard Webhooks signature verification (the scheme Polar uses) ---
//
// Headers: webhook-id, webhook-timestamp, webhook-signature. Signed content is
// `${id}.${timestamp}.${body}`; signature = base64(HMAC-SHA256(key, content)).
// The secret is "whsec_<base64>"; the signing key is the decoded bytes.

const toB64 = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function verifyWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
): Promise<boolean> {
  secret = secret.trim(); // tolerate stray whitespace/newlines around the secret
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;

  // Reject stale deliveries (replay protection): 5-minute tolerance.
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = fromB64(rawSecret);
  } catch {
    keyBytes = new TextEncoder().encode(secret);
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = toB64(mac);

  // Header is a space-delimited list of "v1,<base64sig>" entries.
  return signature.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    return !!sig && sig.length === expected.length && timingSafeEqual(sig, expected);
  });
}
