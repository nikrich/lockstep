// Shared domain types for the desktop app. Where they mirror the coordination
// server, the field names match src/lib/types.ts so the API maps cleanly.

export type FileState =
  | "synced"
  | "locked" // locked by someone else
  | "mine" // locked by you
  | "conflict"
  | "modified";

export type StoreKind = "git" | "bucket";

/** A row in the Repository view — a merge of local git status + server locks. */
export interface RepoFile {
  path: string;
  size: string;
  state: FileState;
  owner: string | null;
  age?: string;
  stale?: boolean;
  staged: boolean;
  store: StoreKind;
  lockId?: string; // server lock id, when locked
}

export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  provider: string;
  avatar_url: string | null;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  role: "owner" | "admin" | "member";
  seats: number;
}

export interface Repo {
  id: string;
  slug: string;
  created_at: number;
}

/** Git LFS lock shape returned by the server (src/routes/locks.ts toJSON). */
export interface ServerLock {
  id: string;
  path: string;
  locked_at: string; // ISO
  owner: { name: string };
}

export interface VerifyLocks {
  ours: ServerLock[];
  theirs: ServerLock[];
}

export interface StorageUsage {
  bytes?: number;
  objects?: number;
  perRepo?: Record<string, { bytes: number; objects: number }>;
  bucket?: string;
  provider?: string;
}

export interface ActivityItem {
  kind: string;
  what: string;
  who: string;
  when: number;
}

export interface BillingInfo {
  plan: string;
  status: string;
  seatsPaid: number;
  seatsUsed: number;
  freeSeats: number;
  seatPrice: number;
  currentPeriodEnd: number | null;
  canManage: boolean;
}

export type ViewKey =
  | "repo"
  | "locks"
  | "history"
  | "storage"
  | "settings"
  | "onboarding";

export interface Toast {
  msg: string;
  icon: string;
  color: string;
}
