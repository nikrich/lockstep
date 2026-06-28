// The desktop sign-in flow, mirroring the Worker's `/auth/plugin/*` loopback
// dance (see src/routes/auth.ts in the coordination server):
//
//   1. We bind a localhost listener on a random port.
//   2. We open the system browser at `{base}/auth/plugin/start` with that
//      loopback as the redirect_uri and a CSRF `state`.
//   3. The user signs in with GitHub/Google; the Worker mints a PAT and
//      redirects the browser back to our loopback with a one-time `code`.
//   4. We hand the `code` to the frontend, which POSTs it to
//      `/auth/plugin/exchange` to receive the real token, then stores it in
//      the OS keychain (see secret.rs).
//
// No token is ever copy-pasted; the secret only ever travels to a listener
// this process owns.

use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
pub struct LoopbackResult {
    pub code: String,
}

fn random_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    // getrandom is infallible on supported platforms; fall back to a time-seed.
    if getrandom::getrandom(&mut buf).is_err() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        for (i, b) in buf.iter_mut().enumerate() {
            *b = ((nanos >> (i % 16)) as u8) ^ (i as u8);
        }
    }
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

/// Percent-encode a value for safe inclusion in a query string.
fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Pull a query parameter value out of a request path like `/callback?code=x&state=y`.
fn query_param(path: &str, key: &str) -> Option<String> {
    let q = path.split_once('?')?.1;
    for pair in q.split('&') {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        if k == key {
            return Some(percent_decode(v));
        }
    }
    None
}

fn percent_decode(s: &str) -> String {
    let bytes = s.replace('+', " ");
    let mut out = Vec::with_capacity(bytes.len());
    let raw = bytes.as_bytes();
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == b'%' && i + 2 < raw.len() {
            if let Ok(b) = u8::from_str_radix(&bytes[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(raw[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

const DONE_PAGE: &str = "<!doctype html><meta charset=\"utf-8\"><title>Lockstep</title>\
<body style=\"margin:0;background:#0a0d11;color:#eef2f6;font:400 16px/1.6 'Segoe UI',system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center\">\
<div style=\"text-align:center\"><div style=\"font-size:22px;font-weight:600;margin-bottom:8px;color:#ffb224\">&#10003; Signed in to Lockstep</div>\
<div style=\"color:#9aa7b6;font-size:14px\">You can close this tab and return to the app.</div></div></body>";

const FAIL_PAGE: &str = "<!doctype html><meta charset=\"utf-8\"><title>Lockstep</title>\
<body style=\"margin:0;background:#0a0d11;color:#eef2f6;font:400 16px/1.6 'Segoe UI',system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center\">\
<div style=\"text-align:center\"><div style=\"font-size:22px;font-weight:600;margin-bottom:8px\">Sign-in failed</div>\
<div style=\"color:#9aa7b6;font-size:14px\">Please restart sign-in from the app.</div></div></body>";

/// Open the browser, wait (up to 5 minutes) for the loopback callback, and
/// return the one-time code. The frontend exchanges it for the PAT.
#[tauri::command]
pub async fn oauth_loopback(app: AppHandle, base_url: String) -> Result<LoopbackResult, String> {
    let base = base_url.trim_end_matches('/').to_string();
    tauri::async_runtime::spawn_blocking(move || run_loopback(app, base))
        .await
        .map_err(|e| format!("loopback task failed: {e}"))?
}

fn run_loopback(app: AppHandle, base: String) -> Result<LoopbackResult, String> {
    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|e| format!("could not start loopback listener: {e}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .ok_or("loopback listener has no port")?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let state = random_hex(16);
    let auth_url = format!(
        "{base}/auth/plugin/start?redirect_uri={}&state={}&client={}",
        enc(&redirect_uri),
        enc(&state),
        enc("Lockstep Desktop"),
    );

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| format!("could not open browser: {e}"))?;

    let deadline = Instant::now() + Duration::from_secs(300);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("sign-in timed out".into());
        }
        match server.recv_timeout(Duration::from_millis(500)) {
            Ok(Some(mut req)) => {
                let url = req.url().to_string();
                // Drain the body so the socket closes cleanly.
                let mut _sink = Vec::new();
                let _ = req.as_reader().read_to_end(&mut _sink);

                if !url.starts_with("/callback") {
                    let _ = req.respond(tiny_http::Response::from_string("ok"));
                    continue;
                }

                let got_state = query_param(&url, "state");
                let code = query_param(&url, "code");

                if got_state.as_deref() != Some(state.as_str()) || code.is_none() {
                    let resp = tiny_http::Response::from_string(FAIL_PAGE).with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    );
                    let _ = req.respond(resp);
                    return Err("state mismatch or missing code".into());
                }

                let resp = tiny_http::Response::from_string(DONE_PAGE).with_header(
                    "Content-Type: text/html; charset=utf-8"
                        .parse::<tiny_http::Header>()
                        .unwrap(),
                );
                let _ = req.respond(resp);
                return Ok(LoopbackResult {
                    code: code.unwrap(),
                });
            }
            Ok(None) => continue, // timed out this tick; loop and re-check deadline
            Err(e) => return Err(format!("loopback receive error: {e}")),
        }
    }
}
