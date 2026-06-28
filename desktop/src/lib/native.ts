// Thin typed wrappers around the Rust commands (see src-tauri/src/*). Keeping
// every `invoke` call in one place means the rest of the app never touches
// stringly-typed command names.

import { invoke } from "@tauri-apps/api/core";

export interface RepoInfo {
  is_repo: boolean;
  root: string;
  branch: string;
  remote: string;
}

export interface ChangedFile {
  path: string;
  index: string;
  work: string;
  staged: boolean;
  untracked: boolean;
}

export interface GitCommit {
  hash: string;
  author: string;
  message: string;
  when: string;
  files: number;
}

// ---- Auth ----

/** Open the browser, run the loopback OAuth dance, return the one-time code. */
export function oauthLoopback(baseUrl: string): Promise<{ code: string }> {
  return invoke("oauth_loopback", { baseUrl });
}

export function storeToken(token: string): Promise<void> {
  return invoke("store_token", { token });
}

export function getToken(): Promise<string | null> {
  return invoke("get_token");
}

export function clearToken(): Promise<void> {
  return invoke("clear_token");
}

// ---- Settings ----

export function loadSettings<T = Record<string, unknown>>(): Promise<T> {
  return invoke("load_settings");
}

export function saveSettings(values: Record<string, unknown>): Promise<void> {
  return invoke("save_settings", { values });
}

// ---- Local working copy ----

export function gitRepoInfo(path: string): Promise<RepoInfo> {
  return invoke("git_repo_info", { path });
}

export function gitStatus(path: string): Promise<ChangedFile[]> {
  return invoke("git_status", { path });
}

export function gitLog(path: string, limit = 40): Promise<GitCommit[]> {
  return invoke("git_log", { path, limit });
}

export function gitSubmit(
  path: string,
  message: string,
  paths: string[],
): Promise<string> {
  return invoke("git_submit", { path, message, paths });
}

/** Discard uncommitted changes for the given paths (empty = whole working tree). */
export function gitDiscard(path: string, paths: string[]): Promise<void> {
  return invoke("git_discard", { path, paths });
}

export interface DiffResult {
  diff: string; // unified diff text (empty when binary)
  binary: boolean;
  untracked: boolean;
}

/** Unified diff of a single file's uncommitted changes (vs HEAD, or empty for new files). */
export function gitDiff(path: string, file: string): Promise<DiffResult> {
  return invoke("git_diff", { path, file });
}
