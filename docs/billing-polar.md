# Connecting Polar (billing)

Lockstep bills per seat through **Polar**, a Merchant of Record: Polar is the
legal seller, so it collects payment, charges + remits global tax/VAT, issues
invoices, and pays out to your South African bank (via Wise/Payoneer). Lockstep
only mirrors the subscription state via a signed webhook.

You can do all of this in **sandbox** first (no real money), then repeat in
production. Nothing in the app charges anyone until these keys are set — until
then every org is on the free tier (5 seats).

## 1. Create the product (once)

1. Sign up at <https://sandbox.polar.sh> (sandbox) — later <https://polar.sh>.
2. Create an **Organization**.
3. **Products → New** → a **subscription** product, monthly, **seat-based**
   pricing at your per-seat price (the app assumes **$12/seat** — change
   `SEAT_PRICE` in `src/routes/orgs.ts` and `seatPrice` defaults if you pick
   another number).
4. Copy the **Product ID** (UUID).

## 2. Create the credentials

- **Settings → Access Tokens → New** → an *Organization* access token with
  checkout + subscription scopes. Copy it (starts `polar_oat_…`).
- **Settings → Webhooks → Add endpoint**:
  - URL: `https://api.lockstepcloud.com/webhooks/polar`
  - Format: **Raw**
  - Events: at least `subscription.created`, `subscription.updated`,
    `subscription.active`, `subscription.canceled`, `subscription.revoked`
  - Copy the **signing secret** (starts `whsec_…`).

## 3. Set the secrets on the Worker

```powershell
# paste each value when prompted (interactive avoids trailing-newline issues)
npx wrangler secret put POLAR_ACCESS_TOKEN
npx wrangler secret put POLAR_PRODUCT_ID
npx wrangler secret put POLAR_WEBHOOK_SECRET
```

`POLAR_SERVER` is a plain var in `wrangler.toml` (`sandbox` by default). When you
move to a live Polar org, set it to `production`, redeploy, and re-create the
three secrets with the production values.

## 4. Verify

1. Dashboard → **Billing**: the "not switched on" notice disappears and
   **Subscribe** becomes active.
2. Click **Subscribe** → you're sent to Polar's hosted checkout for your current
   seat count. Pay with a Polar **sandbox test card**.
3. Polar fires the webhook → the org flips to **Pro / active** with the paid seat
   count and renewal date. **Manage billing** then opens the Polar customer
   portal (card + invoices live there).

## How it maps

| Lockstep | Polar |
|----------|-------|
| active members in an org | subscription **seats** (quantity) |
| `POST /orgs/:id/billing/checkout` | `POST /v1/checkouts/` (metadata `org_id`) |
| `POST /webhooks/polar` | Standard-Webhooks signed `subscription.*` events |
| org `subscription_status` / `seats_paid` / `current_period_end` | mirrored from the webhook |
| card, invoices, tax | owned by Polar (customer portal) |
