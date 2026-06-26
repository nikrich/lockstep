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

  const post = (withSeats: boolean) => {
    const body: Record<string, unknown> = {
      products: [env.POLAR_PRODUCT_ID],
      success_url: opts.successUrl,
      metadata: { org_id: opts.orgId },
    };
    if (opts.email) body.customer_email = opts.email;
    if (withSeats && opts.seats && opts.seats > 0) body.seats = Math.min(1000, Math.max(1, opts.seats));
    return fetch(`${apiBase(env)}/v1/checkouts/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  let res = await post(true);
  // A non-seat-based product rejects `seats` (422); fall back to a flat checkout.
  if (res.status === 422) {
    const detail = await res.text();
    if (!detail.toLowerCase().includes("seat")) throw new Error(`polar checkout failed: 422 ${detail}`);
    res = await post(false);
  }
  if (!res.ok) throw new Error(`polar checkout failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { id: string; url: string };
  return { url: j.url, id: j.id };
}

/** The product's per-seat price in cents, read from Polar (KV-cached 1h). */
export async function getSeatPriceCents(env: Env): Promise<number | null> {
  if (!billingConfigured(env)) return null;
  const cacheKey = `seatprice:${env.POLAR_PRODUCT_ID}`;
  try {
    const cached = await env.SESSIONS.get(cacheKey);
    if (cached !== null) return parseInt(cached, 10) || null;
  } catch {
    /* ignore cache miss */
  }
  try {
    const res = await fetch(`${apiBase(env)}/v1/products/${env.POLAR_PRODUCT_ID}`, {
      headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      prices?: Array<{ amount_type?: string; price_per_seat?: number; amount?: number }>;
    };
    const prices = j.prices || [];
    const price = prices.find((p) => p.amount_type === "seat_based") || prices[0];
    const cents = price?.price_per_seat ?? price?.amount ?? null;
    if (cents != null) {
      try {
        await env.SESSIONS.put(cacheKey, String(cents), { expirationTtl: 3600 });
      } catch {
        /* best-effort cache */
      }
    }
    return cents;
  } catch {
    return null;
  }
}

/**
 * The owner member's id for a customer. Seat-based subscriptions make the buyer
 * a "team customer", and a portal session for a team customer requires a
 * member_id (Polar rejects with "member_id is required for team customers"
 * otherwise). Returns null for plain individual customers (no members listed).
 */
async function ownerMemberId(env: Env, customerId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${apiBase(env)}/v1/members/?customer_id=${encodeURIComponent(customerId)}&limit=100`,
      { headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { items?: Array<{ id: string; role?: string }> };
    const items = j.items || [];
    const owner = items.find((m) => m.role === "owner") || items[0];
    return owner?.id ?? null;
  } catch {
    return null;
  }
}

export interface SubscriptionAmount {
  grossCents: number; // list price before any discount
  netCents: number; // what the customer actually pays this period
  currency: string;
  discountLabel: string | null; // e.g. "100% off forever", null if no discount
}

/**
 * The subscription's real recurring amount, with any Polar discount applied.
 * The dashboard otherwise computes seats × price locally, which ignores
 * discounts/coupons. `amount` from Polar is the gross (pre-discount) total;
 * the `discount` object carries either basis_points (percentage) or a fixed
 * amount. Returns null if it can't be fetched (caller falls back to the
 * computed estimate).
 */
export async function getSubscriptionAmount(
  env: Env,
  subscriptionId: string,
): Promise<SubscriptionAmount | null> {
  if (!env.POLAR_ACCESS_TOKEN) return null;
  try {
    const res = await fetch(`${apiBase(env)}/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    const s = (await res.json()) as {
      amount?: number;
      currency?: string;
      discount?: { type?: string; duration?: string; basis_points?: number; amount?: number } | null;
    };
    const gross = s.amount ?? 0;
    const d = s.discount || null;
    let net = gross;
    let label: string | null = null;
    const forever = d?.duration === "forever" ? " forever" : "";
    if (d && typeof d.basis_points === "number") {
      net = Math.max(0, Math.round((gross * (10000 - d.basis_points)) / 10000));
      label = `${d.basis_points / 100}% off${forever}`;
    } else if (d && typeof d.amount === "number") {
      net = Math.max(0, gross - d.amount);
      label = `$${(d.amount / 100).toFixed(2)} off${forever}`;
    }
    return { grossCents: gross, netCents: net, currency: (s.currency || "usd").toUpperCase(), discountLabel: label };
  } catch {
    return null;
  }
}

/** Create a customer-portal session so a customer can manage card + invoices. */
export async function createPortalSession(env: Env, customerId: string): Promise<string> {
  if (!env.POLAR_ACCESS_TOKEN) throw new Error("billing is not configured");
  const memberId = await ownerMemberId(env, customerId);
  const body: Record<string, unknown> = { customer_id: customerId };
  if (memberId) body.member_id = memberId; // required for team (seat-based) customers
  const res = await fetch(`${apiBase(env)}/v1/customer-sessions/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

  // Provided signatures (header is a space-delimited list of "v1,<base64sig>").
  const provided = signature
    .split(" ")
    .map((p) => (p.includes(",") ? p.split(",")[1] : p))
    .filter((s): s is string => !!s);
  const signedContent = `${id}.${timestamp}.${rawBody}`;

  // Polar derives the HMAC key from the UTF-8 bytes of the WHOLE secret string
  // (e.g. "polar_whs_…"); svix-native secrets are "whsec_<base64>". Accept any.
  for (const keyBytes of candidateKeys(secret)) {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
    const expected = toB64(mac);
    if (provided.some((s) => s.length === expected.length && timingSafeEqual(s, expected))) return true;
  }
  return false;
}

function candidateKeys(secret: string): Uint8Array[] {
  const keys: Uint8Array[] = [new TextEncoder().encode(secret)]; // Polar: utf-8 of the full secret
  if (secret.startsWith("whsec_")) {
    try {
      keys.push(fromB64(secret.slice(6)));
    } catch {
      /* not base64 */
    }
  } else {
    try {
      keys.push(fromB64(secret));
    } catch {
      /* not base64 */
    }
  }
  return keys;
}
