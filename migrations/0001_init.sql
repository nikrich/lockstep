-- Lockstep schema. D1 (SQLite) is the strongly-consistent source of truth.
-- KV caches sessions/tokens for the hot path; locks live HERE so acquisition
-- is transactional (KV's eventual consistency would allow double-locking).

-- Users authenticate to the dashboard via OAuth (GitHub/Google). One row per
-- person, keyed by provider identity.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- internal uuid
  provider      TEXT NOT NULL,               -- 'github' | 'google'
  provider_id   TEXT NOT NULL,               -- stable id from the provider
  email         TEXT,
  name          TEXT,
  avatar_url    TEXT,
  created_at    INTEGER NOT NULL,            -- unix seconds
  UNIQUE (provider, provider_id)
);

-- Repositories (projects). Phase 1 keeps this minimal; teams/permissions later.
CREATE TABLE repos (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,        -- used in the URL path
  owner_id      TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL
);

-- Personal Access Tokens: how machines (git CLI, git-lfs, UE plugin, CI)
-- authenticate. We store only a SHA-256 hash of the token, never the token.
CREATE TABLE tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,               -- human label, e.g. "laptop", "ci"
  token_hash    TEXT NOT NULL UNIQUE,        -- sha256(secret), hex
  scopes        TEXT NOT NULL DEFAULT 'repo',
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  expires_at    INTEGER                      -- null = no expiry
);
CREATE INDEX idx_tokens_user ON tokens(user_id);

-- File locks. One active lock per (repo, path) — enforced by the UNIQUE index.
-- Acquisition is a single INSERT that fails on conflict => no race window.
CREATE TABLE locks (
  id            TEXT PRIMARY KEY,
  repo_id       TEXT NOT NULL REFERENCES repos(id),
  path          TEXT NOT NULL,
  ref           TEXT,                        -- e.g. refs/heads/main
  owner_id      TEXT NOT NULL REFERENCES users(id),
  owner_name    TEXT NOT NULL,               -- denormalized for fast listing
  locked_at     INTEGER NOT NULL,
  UNIQUE (repo_id, path)
);
CREATE INDEX idx_locks_repo ON locks(repo_id);
