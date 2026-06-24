-- Local dev seed. Apply with:
--   wrangler d1 execute lockstep --local --file scripts/seed-local.sql
-- Dev PAT (use as Bearer token): lsk_dev_local_0001
-- (token_hash below is sha256 of that string). DEV ONLY — never seed prod.

INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, avatar_url, created_at)
  VALUES ('u_dev', 'github', 'devlocal', 'you@auroragames.dev', 'You', NULL, 1782000000);

INSERT OR IGNORE INTO tokens (id, user_id, name, token_hash, scopes, created_at)
  VALUES ('t_dev', 'u_dev', 'Dev token', '628a36bd8835b765c5bf9a1ca677e8a5b6d57f75dc5e9c7039523509bda0a890', 'lock,read,write', 1782000000);

INSERT OR IGNORE INTO orgs (id, name, slug, plan, created_at)
  VALUES ('o_dev', 'Aurora Games', 'aurora-games', 'free', 1782000000);

INSERT OR IGNORE INTO org_members (org_id, user_id, role, seat_active, created_at)
  VALUES ('o_dev', 'u_dev', 'owner', 1, 1782000000);

INSERT OR IGNORE INTO repos (id, slug, owner_id, org_id, created_at)
  VALUES ('r_dev1', 'aurora-rpg', 'u_dev', 'o_dev', 1782000000);
INSERT OR IGNORE INTO repos (id, slug, owner_id, org_id, created_at)
  VALUES ('r_dev2', 'aurora-tools', 'u_dev', 'o_dev', 1782000000);
