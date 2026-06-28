// File classification + small view helpers shared across views.
//
// The git-vs-bucket split mirrors the architecture doc: unmergeable binaries
// (.uasset/.umap/.fbx/.psd/...) stream to the bucket and are lockable; source
// and config live in git with optimistic merge.

import type { FileState, RepoFile, StoreKind } from "./types";

const BUCKET_EXTS = new Set([
  "uasset",
  "umap",
  "fbx",
  "psd",
  "png",
  "tga",
  "wav",
  "mp4",
  "exr",
  "hdr",
  "bin",
  "blend",
  "max",
]);

export function extOf(path: string): string {
  const name = path.split("/").pop() || path;
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

export function storeFor(path: string): StoreKind {
  return BUCKET_EXTS.has(extOf(path)) ? "bucket" : "git";
}

export const EXT_TINTS: Record<string, string> = {
  uasset: "var(--status-mine)",
  umap: "var(--amber-300)",
  fbx: "var(--status-synced)",
  psd: "var(--status-pending)",
  png: "var(--status-pending)",
  cpp: "var(--slate-300)",
  h: "var(--slate-300)",
  ini: "var(--slate-400)",
  md: "var(--slate-400)",
  json: "var(--slate-400)",
};

export function tintForExt(ext: string): string {
  return EXT_TINTS[ext] || "var(--slate-400)";
}

export interface StatusMeta {
  c: string;
  bg: string;
  glyph: string;
  text: string;
  badge: string;
}

export const STATUS: Record<FileState, StatusMeta> = {
  synced: {
    c: "var(--status-synced)",
    bg: "var(--status-synced-bg)",
    glyph: "●",
    text: "Synced",
    badge: "Synced",
  },
  locked: {
    c: "var(--status-locked)",
    bg: "var(--status-locked-bg)",
    glyph: "◆",
    text: "Locked",
    badge: "Locked",
  },
  mine: {
    c: "var(--status-mine)",
    bg: "var(--status-mine-bg)",
    glyph: "◆",
    text: "Locked by you",
    badge: "Mine",
  },
  conflict: {
    c: "var(--status-conflict)",
    bg: "var(--status-conflict-bg)",
    glyph: "▲",
    text: "Conflict",
    badge: "Conflict",
  },
  modified: {
    c: "var(--slate-200)",
    bg: "rgba(255,255,255,0.06)",
    glyph: "○",
    text: "Modified",
    badge: "Modified",
  },
};

const AV_TINTS = [
  "#3b9eff",
  "#2fcf91",
  "#9b8cff",
  "#ffb224",
  "#ff8f6b",
  "#5ad1c9",
  "#e879b9",
];

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0] || "")[0] || "") + ((p[1] || "")[0] || "");
}

export function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_TINTS[h % AV_TINTS.length];
}

export function splitPath(path: string): { dir: string; name: string } {
  const parts = path.split("/");
  const name = parts.pop() || path;
  const dir = parts.length ? parts.join("/") + "/" : "";
  return { dir, name };
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

/** The sample working copy from the design — shown until a local repo is set. */
export const DEMO_FILES: RepoFile[] = [
  { path: "Source/Gameplay/Weapon.cpp", size: "9 KB", state: "conflict", owner: "Kai Renner", staged: false, store: "git" },
  { path: "Source/Gameplay/Player.cpp", size: "14 KB", state: "modified", owner: null, staged: true, store: "git" },
  { path: "Source/Gameplay/Player.h", size: "3 KB", state: "modified", owner: null, staged: true, store: "git" },
  { path: "Config/DefaultGame.ini", size: "8 KB", state: "modified", owner: null, staged: false, store: "git" },
  { path: "Content/Maps/Arena.umap", size: "248 MB", state: "mine", owner: "You", staged: true, store: "bucket" },
  { path: "Content/Characters/Hero/Hero.uasset", size: "61 MB", state: "mine", owner: "You", staged: true, store: "bucket" },
  { path: "Content/UI/HUD/Crosshair.psd", size: "18 MB", state: "mine", owner: "You", staged: false, store: "bucket" },
  { path: "Content/FX/Explosion.uasset", size: "33 MB", state: "locked", owner: "Kai Renner", age: "1h 40m", staged: false, store: "bucket" },
  { path: "Content/Maps/Lobby.umap", size: "180 MB", state: "locked", owner: "Theo Park", age: "3h 02m", staged: false, store: "bucket" },
  { path: "Content/Vehicles/Tank/Tank.uasset", size: "94 MB", state: "locked", owner: "Juno Sandak", age: "22h", stale: true, staged: false, store: "bucket" },
  { path: "Content/Animation/Boss/Roar.fbx", size: "12 MB", state: "locked", owner: "Mara Voss", age: "5h 18m", stale: true, staged: false, store: "bucket" },
  { path: "Content/Materials/Stone_M.uasset", size: "5 MB", state: "synced", owner: null, staged: false, store: "bucket" },
  { path: "Content/Maps/Arena_BuiltData.uasset", size: "410 MB", state: "synced", owner: null, staged: false, store: "bucket" },
  { path: "README.md", size: "4 KB", state: "synced", owner: null, staged: false, store: "git" },
];

export const DEMO_TEAM = ["You", "Kai Renner", "Theo Park", "Mara Voss", "Juno Sandak"];
