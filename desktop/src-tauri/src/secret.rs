// The Personal Access Token at rest. Stored in the OS credential store —
// Windows Credential Manager, macOS Keychain, or the Linux Secret Service —
// via the `keyring` crate, so the token is never written to disk in plaintext.
//
// This mirrors the architecture doc: "for git operations the app uses a PAT
// stored in the OS credential helper."

use keyring::Entry;

const SERVICE: &str = "com.lockstepcloud.desktop";
const ACCOUNT: &str = "personal-access-token";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("keychain unavailable: {e}"))
}

/// Persist the PAT in the OS credential store.
#[tauri::command]
pub fn store_token(token: String) -> Result<(), String> {
    entry()?
        .set_password(&token)
        .map_err(|e| format!("could not save token: {e}"))
}

/// Read the PAT back, or `None` if the user has never signed in.
#[tauri::command]
pub fn get_token() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("could not read token: {e}")),
    }
}

/// Forget the PAT (sign out). Idempotent — succeeds even if nothing was stored.
#[tauri::command]
pub fn clear_token() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("could not clear token: {e}")),
    }
}
