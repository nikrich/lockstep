-- Billing via Polar (Merchant of Record). Lockstep tracks the subscription
-- state mirrored from Polar webhooks; cards + invoices live on Polar's side.
ALTER TABLE orgs ADD COLUMN polar_customer_id TEXT;
ALTER TABLE orgs ADD COLUMN polar_subscription_id TEXT;
ALTER TABLE orgs ADD COLUMN subscription_status TEXT;   -- none|active|trialing|past_due|canceled
ALTER TABLE orgs ADD COLUMN seats_paid INTEGER DEFAULT 0;
ALTER TABLE orgs ADD COLUMN current_period_end INTEGER;
