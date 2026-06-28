// A tiny JSON settings file in the app config dir. Holds non-secret preferences
// the desktop app needs across launches: which API to talk to, the signed-in
// account label, the active org/repo, the local working-copy path, and UI
// toggles (soft-lock, auto-lock, …). Secrets never live here — the PAT is in
// the OS keychain (see secret.rs).

use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create config dir: {e}"))?;
    Ok(dir.join("settings.json"))
}

/// Read the whole settings blob (defaults to `{}`).
#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Value, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("could not read settings: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("settings file is corrupt: {e}"))
}

/// Replace the whole settings blob.
#[tauri::command]
pub fn save_settings(app: AppHandle, values: Value) -> Result<(), String> {
    let path = settings_path(&app)?;
    let pretty = serde_json::to_string_pretty(&values).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| format!("could not write settings: {e}"))
}
