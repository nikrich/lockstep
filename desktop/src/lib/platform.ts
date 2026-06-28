// The OS credential store the `keyring` crate maps to per platform (see
// src-tauri/src/secret.rs). Detected synchronously from the webview's
// userAgent so UI copy reflects the user's actual OS — Windows users should
// read "Windows Credential Manager", not the macOS-centric "OS keychain".

type OS = "windows" | "macos" | "linux";

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macos";
  return "linux";
}

const CREDENTIAL_STORE: Record<OS, string> = {
  windows: "Windows Credential Manager",
  macos: "macOS Keychain",
  linux: "the system keyring",
};

/** Human-readable name of the OS credential store the PAT is saved in. */
export const credentialStoreName: string = CREDENTIAL_STORE[detectOS()];
