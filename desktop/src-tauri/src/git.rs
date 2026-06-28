// Local working-copy integration. The coordination server is the source of
// truth for *locks*; the local git repo is the source of truth for *changes*.
// The frontend merges the two into the file list the design shows.
//
// We shell out to the user's `git` (game devs already have it, and it picks up
// their LFS/credential config) rather than linking a git library.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

// On Windows, spawning git.exe from a GUI (windowed-subsystem) app pops a visible
// console window for each invocation. CREATE_NO_WINDOW suppresses it so the user
// never sees terminal windows flashing.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn git(repo: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(repo).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd
        .output()
        .map_err(|e| format!("could not run git (is it installed?): {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[derive(Serialize)]
pub struct RepoInfo {
    pub is_repo: bool,
    pub root: String,
    pub branch: String,
    pub remote: String,
}

/// Probe a directory: is it a git repo, what branch, what origin remote.
#[tauri::command]
pub fn git_repo_info(path: String) -> Result<RepoInfo, String> {
    if !Path::new(&path).exists() {
        return Ok(RepoInfo {
            is_repo: false,
            root: String::new(),
            branch: String::new(),
            remote: String::new(),
        });
    }
    let root = match git(&path, &["rev-parse", "--show-toplevel"]) {
        Ok(s) => s.trim().to_string(),
        Err(_) => {
            return Ok(RepoInfo {
                is_repo: false,
                root: String::new(),
                branch: String::new(),
                remote: String::new(),
            })
        }
    };
    let branch = git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "HEAD".into());
    let remote = git(&path, &["remote", "get-url", "origin"])
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    Ok(RepoInfo {
        is_repo: true,
        root,
        branch,
        remote,
    })
}

#[derive(Serialize)]
pub struct ChangedFile {
    pub path: String,
    pub index: String,  // staged status (X in porcelain)
    pub work: String,   // working-tree status (Y)
    pub staged: bool,
    pub untracked: bool,
}

/// `git status --porcelain` mapped into structured entries.
#[tauri::command]
pub fn git_status(path: String) -> Result<Vec<ChangedFile>, String> {
    let raw = git(&path, &["status", "--porcelain=v1", "--untracked-files=all"])?;
    let mut files = Vec::new();
    for line in raw.lines() {
        if line.len() < 4 {
            continue;
        }
        let x = &line[0..1];
        let y = &line[1..2];
        let mut p = line[3..].to_string();
        // Renames look like "old -> new"; keep the new path.
        if let Some((_, new)) = p.split_once(" -> ") {
            p = new.to_string();
        }
        let untracked = x == "?" && y == "?";
        let staged = x != " " && x != "?";
        files.push(ChangedFile {
            path: p,
            index: x.to_string(),
            work: y.to_string(),
            staged,
            untracked,
        });
    }
    Ok(files)
}

#[derive(Serialize)]
pub struct Commit {
    pub hash: String,
    pub author: String,
    pub message: String,
    pub when: String,
    pub files: u32,
}

/// Recent history for the History view (local fallback when the org activity
/// feed isn't available).
#[tauri::command]
pub fn git_log(path: String, limit: Option<u32>) -> Result<Vec<Commit>, String> {
    let n = format!("-{}", limit.unwrap_or(40));
    // ONE process for the whole timeline. \u{01} marks the start of each commit's
    // record; \u{1f} separates fields; --shortstat appends the "N files changed"
    // line after each record, which we parse for the file count. (Previously this
    // ran a separate `git show` per commit — N+1 subprocesses that froze the UI
    // and, on Windows, flashed a console window for every one.)
    let raw = git(
        &path,
        &[
            "log",
            &n,
            "--no-color",
            "--shortstat",
            "--pretty=format:\u{01}%h\u{1f}%an\u{1f}%s\u{1f}%cr",
        ],
    )?;
    let mut commits = Vec::new();
    for chunk in raw.split('\u{01}') {
        if chunk.trim().is_empty() {
            continue;
        }
        let mut lines = chunk.lines();
        let header = lines.next().unwrap_or("");
        let parts: Vec<&str> = header.split('\u{1f}').collect();
        if parts.len() < 4 {
            continue;
        }
        // The shortstat line (if any) looks like " 3 files changed, 5 insertions(+)".
        let files = lines
            .find_map(|l| {
                let t = l.trim();
                if t.contains("changed") {
                    t.split_whitespace().next().and_then(|x| x.parse::<u32>().ok())
                } else {
                    None
                }
            })
            .unwrap_or(0);
        commits.push(Commit {
            hash: parts[0].to_string(),
            author: parts[1].to_string(),
            message: parts[2].to_string(),
            when: parts[3].to_string(),
            files,
        });
    }
    Ok(commits)
}

/// Stage the given paths (or all), commit, and push. Returns the new commit
/// hash. LFS blobs are uploaded by git-lfs during push using the presigned URLs
/// the coordination server hands out — bytes never touch the server.
#[tauri::command]
pub fn git_submit(path: String, message: String, paths: Vec<String>) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("a commit message is required".into());
    }
    if paths.is_empty() {
        git(&path, &["add", "-A"])?;
    } else {
        let mut args = vec!["add", "--"];
        for p in &paths {
            args.push(p.as_str());
        }
        git(&path, &args)?;
    }
    git(&path, &["commit", "-m", &message])?;
    git(&path, &["push"])?;
    let hash = git(&path, &["rev-parse", "--short", "HEAD"])?
        .trim()
        .to_string();
    Ok(hash)
}

/// Discard uncommitted changes. With no paths, reverts the whole working tree to
/// HEAD (unstage everything, restore tracked files, delete untracked). With
/// paths, only those entries are reverted — each is unstaged, then either
/// restored (tracked) or removed (untracked). Destructive: the frontend confirms
/// first.
#[tauri::command]
pub fn git_discard(path: String, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        git(&path, &["reset", "-q"])?;
        git(&path, &["checkout", "-q", "--", "."])?;
        git(&path, &["clean", "-fdq"])?;
        return Ok(());
    }
    for p in &paths {
        // Unstage first so `checkout` reverts the working tree back to HEAD.
        let _ = git(&path, &["reset", "-q", "--", p]);
        // A tracked file is restored; an untracked one makes checkout fail, so
        // fall back to removing it.
        if git(&path, &["checkout", "-q", "--", p]).is_err() {
            git(&path, &["clean", "-fdq", "--", p])?;
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct DiffResult {
    pub diff: String, // unified diff text (empty when binary)
    pub binary: bool,
    pub untracked: bool,
}

// Run a git diff and return (stdout, exit_code). Unlike `git()`, this tolerates
// the exit code 1 that `git diff --no-index`/`--exit-code` use to mean "there
// are differences" — that's success for us, not an error.
fn git_diff_cmd(repo: &str, args: &[&str]) -> Result<(String, i32), String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(repo).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd
        .output()
        .map_err(|e| format!("could not run git (is it installed?): {e}"))?;
    Ok((
        String::from_utf8_lossy(&out.stdout).into_owned(),
        out.status.code().unwrap_or(-1),
    ))
}

/// Unified diff of a single file's uncommitted changes. Tracked files diff
/// against HEAD (staged + unstaged); a new untracked file diffs against empty so
/// it reads as all-added. Binary files report `binary: true` with no text.
#[tauri::command]
pub fn git_diff(path: String, file: String) -> Result<DiffResult, String> {
    // Tracked changes vs the last commit.
    let (mut diff, _) = git_diff_cmd(&path, &["diff", "--no-color", "HEAD", "--", &file])?;
    let mut untracked = false;
    if diff.trim().is_empty() {
        // No tracked diff — it may be a brand-new untracked file. Diff against
        // /dev/null (a git-ism that works cross-platform) so it shows as added.
        let (d, code) =
            git_diff_cmd(&path, &["diff", "--no-color", "--no-index", "--", "/dev/null", &file])?;
        // code 1 = differences found (expected); >1 = a real failure we ignore,
        // leaving an empty diff ("no changes").
        if code <= 1 && !d.trim().is_empty() {
            diff = d;
            untracked = true;
        }
    }
    let binary = diff.contains("Binary files ") || diff.contains("GIT binary patch");
    Ok(DiffResult {
        diff: if binary { String::new() } else { diff },
        binary,
        untracked,
    })
}
