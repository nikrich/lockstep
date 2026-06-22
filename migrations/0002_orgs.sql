-- Multi-tenant control plane: orgs own storage + seats; repos belong to orgs.
-- The org's storage SECRET is stored encrypted (envelope encryption); only the
-- Worker decrypts it at presign time. Clients never receive bucket credentials.

CREATE TABLE orgs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL
);

-- Membership = a seat. role: owner | admin | member.
CREATE TABLE org_members (
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL DEFAULT 'member',
  seat_active INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX idx_members_user ON org_members(user_id);

-- One storage connection per org (S3-compatible: R2/B2/Wasabi/MinIO/S3).
-- secret_cipher = AES-256-GCM(iv:ciphertext) of the secret access key.
CREATE TABLE org_storage (
  org_id        TEXT PRIMARY KEY REFERENCES orgs(id),
  provider      TEXT NOT NULL,                 -- 'r2' | 'b2' | 'wasabi' | 's3' | 'minio'
  endpoint      TEXT NOT NULL,                 -- S3 endpoint URL
  region        TEXT NOT NULL DEFAULT 'auto',
  bucket        TEXT NOT NULL,
  prefix        TEXT,                          -- optional key prefix
  access_key_id TEXT NOT NULL,
  secret_cipher TEXT NOT NULL,                 -- encrypted; never returned to clients
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- Pending seat invitations (emailed link carries the raw token; we store a hash).
CREATE TABLE invites (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES orgs(id),
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_invites_org ON invites(org_id);

-- Repos now belong to an org (nullable for legacy/dev auto-provisioned repos).
ALTER TABLE repos ADD COLUMN org_id TEXT REFERENCES orgs(id);
