-- Audit/activity events: dynamic actions worth showing in the feed (pushes,
-- locks). Control-plane events (org/repo/storage/token created) are still
-- derived from their own records, so they aren't duplicated here.
CREATE TABLE events (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  repo_id    TEXT,
  actor_id   TEXT,
  actor_name TEXT,
  kind       TEXT NOT NULL,   -- push | lock | unlock | force_unlock
  detail     TEXT,            -- human-readable line for the feed
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_org ON events(org_id, created_at);
