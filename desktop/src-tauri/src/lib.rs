// Lockstep desktop — Tauri shell. Wires the plugins (http for API calls without
// browser CORS, opener for the OAuth browser hop, dialog for folder picking) and
// exposes the native commands the React frontend invokes.

mod git;
mod oauth;
mod secret;
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // auth
            oauth::oauth_loopback,
            secret::store_token,
            secret::get_token,
            secret::clear_token,
            // settings
            store::load_settings,
            store::save_settings,
            // local working copy
            git::git_repo_info,
            git::git_status,
            git::git_log,
            git::git_submit,
            git::git_discard,
            git::git_diff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lockstep desktop");
}
