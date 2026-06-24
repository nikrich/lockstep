// Inbound webhooks. NOT behind requireAuth — authenticity is proven by the
// provider's signature instead. Mounted at /webhooks in index.ts.
import { Hono } from "hono";
import type { Env, Vars } from "../lib/types";
import { verifyWebhook } from "../lib/polar";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface PolarEvent {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string;
    seats?: number;
    current_period_end?: string | null;
    metadata?: Record<string, string>;
  };
}

// Polar subscription/order events → mirror the subscription state onto the org.
app.post("/polar", async (c) => {
  const raw = await c.req.text();
  const ok = await verifyWebhook(
    c.env.POLAR_WEBHOOK_SECRET || "",
    {
      id: c.req.header("webhook-id") ?? null,
      timestamp: c.req.header("webhook-timestamp") ?? null,
      signature: c.req.header("webhook-signature") ?? null,
    },
    raw,
  );
  if (!ok) return c.json({ message: "invalid signature" }, 401);

  let evt: PolarEvent;
  try {
    evt = JSON.parse(raw) as PolarEvent;
  } catch {
    return c.json({ message: "bad json" }, 400);
  }

  const type = evt.type || "";
  const data = evt.data || {};

  if (type.startsWith("subscription.")) {
    const orgId = data.metadata?.org_id;
    if (orgId) {
      const status = data.status || "active";
      const active = status === "active" || status === "trialing";
      const periodEnd = data.current_period_end
        ? Math.floor(new Date(data.current_period_end).getTime() / 1000)
        : null;
      await c.env.DB.prepare(
        `UPDATE orgs SET
           polar_subscription_id = ?,
           polar_customer_id = COALESCE(?, polar_customer_id),
           subscription_status = ?,
           plan = ?,
           seats_paid = COALESCE(?, seats_paid),
           current_period_end = ?
         WHERE id = ?`,
      )
        .bind(
          data.id ?? null,
          data.customer_id ?? null,
          status,
          active ? "pro" : "free",
          data.seats ?? null,
          periodEnd,
          orgId,
        )
        .run();
    }
  }

  return c.json({ ok: true });
});

export default app;
