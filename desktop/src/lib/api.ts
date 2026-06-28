// Typed client for the Lockstep coordination Worker.
//
// Requests go through @tauri-apps/plugin-http (the `fetch` here is the Tauri
// one, which proxies through Rust) rather than the webview's fetch. That's
// deliberate: the Worker's CORS only allows the dashboard origins, and the
// Tauri webview origin (tauri://localhost / http://tauri.localhost) is not one
// of them. Going through Rust sidesteps CORS entirely while keeping the PAT in
// the Authorization header.

import { fetch } from "@tauri-apps/plugin-http";
import type {
  ActivityItem,
  BillingInfo,
  Org,
  Repo,
  ServerLock,
  StorageUsage,
  UserProfile,
  VerifyLocks,
} from "./types";

export const DEFAULT_API = "https://api.lockstepcloud.com";
export const LOCAL_API = "http://localhost:8787";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export class LockstepApi {
  baseUrl: string;
  token: string | null;

  constructor(baseUrl: string, token: string | null) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message)
          : undefined) || `request failed (${res.status})`;
      throw new ApiError(res.status, msg);
    }
    return data as T;
  }

  // ---- Identity / auth ----

  /** Exchange the loopback one-time code for the real PAT. */
  async exchangePluginCode(code: string): Promise<{ token: string; name: string }> {
    return this.req("POST", "/auth/plugin/exchange", { code });
  }

  me(): Promise<{ user: UserProfile; via: string }> {
    return this.req("GET", "/auth/me");
  }

  // ---- Control plane: orgs / repos / members / storage / billing ----

  async listOrgs(): Promise<Org[]> {
    const r = await this.req<{ orgs: Org[] }>("GET", "/orgs");
    return r.orgs ?? [];
  }

  async listRepos(orgId: string): Promise<Repo[]> {
    const r = await this.req<{ repos: Repo[] }>("GET", `/orgs/${orgId}/repos`);
    return r.repos ?? [];
  }

  // The server returns `{ totalBytes, objects, byRepo: [{repo,bytes,objects}] }`;
  // map it onto the client `StorageUsage` shape (`bytes` / `perRepo`) the views
  // actually read, otherwise the Storage view never sees real usage.
  async storageUsage(orgId: string): Promise<StorageUsage> {
    const u = await this.req<{
      connected: boolean;
      totalBytes: number;
      objects: number;
      byRepo: Array<{ repo: string; bytes: number; objects: number }>;
      truncated?: boolean;
    }>("GET", `/orgs/${orgId}/storage/usage`);
    return {
      bytes: u.totalBytes,
      objects: u.objects,
      perRepo: Object.fromEntries(
        (u.byRepo ?? []).map((r) => [r.repo, { bytes: r.bytes, objects: r.objects }]),
      ),
    };
  }

  storageConfig(orgId: string): Promise<{
    storage: { provider: string; bucket: string; endpoint: string; region: string; prefix: string | null } | null;
  }> {
    return this.req("GET", `/orgs/${orgId}/storage`);
  }

  billing(orgId: string): Promise<BillingInfo> {
    return this.req("GET", `/orgs/${orgId}/billing`);
  }

  async activity(orgId: string): Promise<ActivityItem[]> {
    const r = await this.req<{ activity: ActivityItem[] }>(
      "GET",
      `/orgs/${orgId}/activity`,
    );
    return r.activity ?? [];
  }

  async members(orgId: string): Promise<{
    members: Array<{
      user_id: string;
      role: string;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
      seat_active: number;
    }>;
    you: string;
    canManage: boolean;
  }> {
    return this.req("GET", `/orgs/${orgId}/members`);
  }

  // ---- Data plane: locks (Git LFS Locking API) ----

  async listLocks(repoSlug: string): Promise<ServerLock[]> {
    const r = await this.req<{ locks: ServerLock[] }>(
      "GET",
      `/${encodeURIComponent(repoSlug)}/locks`,
    );
    return r.locks ?? [];
  }

  verifyLocks(repoSlug: string): Promise<VerifyLocks> {
    return this.req("POST", `/${encodeURIComponent(repoSlug)}/locks/verify`, {});
  }

  acquireLock(repoSlug: string, path: string): Promise<{ lock: ServerLock }> {
    return this.req("POST", `/${encodeURIComponent(repoSlug)}/locks`, { path });
  }

  /** Report a successful submit so it shows in the org activity feed. */
  reportPush(repoSlug: string, files: number, commit?: string): Promise<{ ok: boolean }> {
    return this.req("POST", `/${encodeURIComponent(repoSlug)}/pushes`, { files, commit });
  }

  /** Release a lock. force+admin lets you break someone else's (stale) lock. */
  unlock(
    repoSlug: string,
    lockId: string,
    force = false,
  ): Promise<{ lock: ServerLock }> {
    return this.req(
      "POST",
      `/${encodeURIComponent(repoSlug)}/locks/${lockId}/unlock`,
      { force },
    );
  }

  // ---- Data plane: LFS batch (presigned URLs; bytes skip the server) ----

  lfsBatch(
    repoSlug: string,
    operation: "upload" | "download",
    objects: Array<{ oid: string; size: number }>,
  ): Promise<{
    transfer: string;
    objects: Array<{
      oid: string;
      size: number;
      actions?: { upload?: { href: string }; download?: { href: string } };
      error?: { code: number; message: string };
    }>;
  }> {
    return this.req("POST", `/${encodeURIComponent(repoSlug)}/objects/batch`, {
      operation,
      objects,
    });
  }
}
