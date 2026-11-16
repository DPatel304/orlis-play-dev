//! Setting up, from the app itself: what a creator who lives elsewhere needs
//! (Tailscale, to reach the family's Orlis; Claude Code, to make games),
//! whether it's there yet, and a button to get each.
//!
//!   setup_status       { tailscale: { installed, state }, claude: { installed, signedIn } }
//!   install_tailscale  Windows' own installer (winget) in a window of its own,
//!                      or else Tailscale's download page in the browser
//!   tailscale_login    the sign-in page Tailscale gives, opened in the browser
//!   install_claude     Claude Code's own installer, in a window of its own
//!   claude_signin      Claude Code, in a window of its own, to sign in once
//!   open_link          a page in the browser - only the few setup pages here
//!
//! Nothing here takes text from a game or a server into a command: every
//! command run is fixed.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;

#[cfg(windows)]
const NO_WINDOW: u32 = 0x0800_0000;
#[cfg(windows)]
const NEW_CONSOLE: u32 = 0x0000_0010;

/// A command that runs quietly (no black window flashing up).
fn quiet(exe: &std::path::Path) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(exe);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(NO_WINDOW);
    }
    cmd
}

/// Where Tailscale's command-line tool is: on the PATH, or where its
/// installer puts it.
pub fn tailscale_exe() -> Option<PathBuf> {
    let mut tried: Vec<PathBuf> = vec!["tailscale".into()];
    if cfg!(windows) {
        for var in ["ProgramFiles", "ProgramW6432"] {
            if let Ok(dir) = std::env::var(var) {
                tried.push(std::path::Path::new(&dir).join("Tailscale").join("tailscale.exe"));
            }
        }
    }
    tried.into_iter().find(|exe| quiet(exe).arg("version").output().map(|o| o.status.success()).unwrap_or(false))
}

/// Tailscale's status, as JSON (None if it isn't installed, or its service
/// isn't answering).
pub fn tailscale_status_json() -> Option<Vec<u8>> {
    let exe = tailscale_exe()?;
    let out = quiet(&exe).args(["status", "--json"]).output().ok()?;
    // (it says "stopped" or "logged out" with a non-zero exit but still JSON)
    if out.stdout.is_empty() { None } else { Some(out.stdout) }
}

/// What Tailscale's doing, in a word the app shows: "on", "signin" (installed,
/// not signed in), "off" (installed, switched off), "starting", or "missing".
pub fn tailscale_state(installed: bool, status: Option<&[u8]>) -> &'static str {
    if !installed {
        return "missing";
    }
    let state = status
        .and_then(|s| serde_json::from_slice::<Value>(s).ok())
        .and_then(|v| v.get("BackendState").and_then(|b| b.as_str()).map(|b| b.to_string()))
        .unwrap_or_default();
    match state.as_str() {
        "Running" => "on",
        "NeedsLogin" | "NeedsMachineAuth" | "NoState" => "signin",
        "Stopped" => "off",
        "Starting" => "starting",
        _ => "signin",
    }
}

#[tauri::command]
pub async fn setup_status() -> Value {
    tauri::async_runtime::spawn_blocking(|| {
        let installed = tailscale_exe().is_some();
        let status = if installed { tailscale_status_json() } else { None };
        let state = tailscale_state(installed, status.as_deref());
        #[cfg(windows)]
        let claude = crate::creating::find_claude().is_some();
        #[cfg(not(windows))]
        let claude = false;
        let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(PathBuf::from);
        let signed_in = claude && home.map(|h| claude_signed_in(&h, std::env::var("ANTHROPIC_API_KEY").ok())).unwrap_or(false);
        json!({ "tailscale": { "installed": installed, "state": state }, "claude": { "installed": claude, "signedIn": signed_in } })
    })
    .await
    .unwrap_or_else(|_| json!({ "tailscale": { "installed": false, "state": "missing" }, "claude": { "installed": false } }))
}

/// The few pages setup may open: Tailscale's and Claude's own.
pub fn allowed_link(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("").to_ascii_lowercase();
    ["tailscale.com", "login.tailscale.com", "pkgs.tailscale.com", "claude.ai", "claude.com", "code.claude.com"].contains(&host.as_str())
        && !rest.contains(['"', '\'', ' ', '<', '>', '\\', '^', '&', '|'])
}

fn open_in_browser(url: &str) -> Result<(), String> {
    if !allowed_link(url) {
        return Err("That page isn't one setup opens.".into());
    }
    #[cfg(windows)]
    {
        quiet(std::path::Path::new("rundll32.exe")).args(["url.dll,FileProtocolHandler", url]).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Only in Orlis Play for Windows.".into())
    }
}

#[tauri::command]
pub fn open_link(url: String) -> Result<(), String> {
    open_in_browser(&url)
}

/// Tailscale: with Windows' own app installer (winget) if this PC has it - in a
/// window of its own, so the progress (and Windows' "allow changes?") is
/// seen - else its download page. { how: "winget" | "browser" }
#[tauri::command]
pub fn install_tailscale() -> Result<Value, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let has_winget = quiet(std::path::Path::new("winget.exe")).arg("--version").output().map(|o| o.status.success()).unwrap_or(false);
        if has_winget {
            let script = "$host.UI.RawUI.WindowTitle = 'Installing Tailscale (Orlis Play)'; winget install --id Tailscale.Tailscale --exact --accept-package-agreements --accept-source-agreements; Write-Host ''; Write-Host 'Done. Sign in to Tailscale when it asks, then go back to Orlis Play.'";
            Command::new("powershell.exe")
                .args(["-NoLogo", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", script])
                .creation_flags(NEW_CONSOLE)
                .spawn()
                .map_err(|e| format!("Couldn't start the installer: {e}"))?;
            return Ok(json!({ "how": "winget" }));
        }
        open_in_browser("https://tailscale.com/download/windows")?;
        Ok(json!({ "how": "browser" }))
    }
    #[cfg(not(windows))]
    {
        Err("Only in Orlis Play for Windows.".into())
    }
}

/// From what `tailscale login` prints: the page to sign in on.
pub fn login_url(text: &str) -> Option<String> {
    text.split_whitespace().find(|w| w.starts_with("https://login.tailscale.com/")).map(|w| w.trim_end_matches(['.', ',']).to_string())
}

/// Signing in to Tailscale: `tailscale login` gives a page to sign in on;
/// that page opens in the browser (it keeps waiting in the background until
/// they've signed in). { opened: true } or { opened: false } if it gave
/// none in time (Tailscale's own icon by the clock signs in too).
#[tauri::command]
pub async fn tailscale_login() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        use std::io::Read;
        use std::sync::mpsc;
        let exe = tailscale_exe().ok_or("Tailscale isn't installed yet.")?;
        let mut child = quiet(&exe)
            .args(["login"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Couldn't start Tailscale's sign-in: {e}"))?;
        let (tx, rx) = mpsc::channel::<String>();
        for pipe in [child.stdout.take().map(|p| Box::new(p) as Box<dyn Read + Send>), child.stderr.take().map(|p| Box::new(p) as Box<dyn Read + Send>)].into_iter().flatten() {
            let tx = tx.clone();
            std::thread::spawn(move || {
                let mut pipe = pipe;
                let mut buf = [0u8; 1024];
                let mut seen = String::new();
                while let Ok(n) = pipe.read(&mut buf) {
                    if n == 0 { break; }
                    seen.push_str(&String::from_utf8_lossy(&buf[..n]));
                    if let Some(u) = login_url(&seen) { let _ = tx.send(u); break; }
                }
            });
        }
        drop(tx);
        match rx.recv_timeout(std::time::Duration::from_secs(20)) {
            Ok(url) => { open_in_browser(&url)?; Ok(json!({ "opened": true })) }
            Err(_) => Ok(json!({ "opened": false })),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Claude Code, with its own installer (the one its setup guide gives), in
/// a window of its own so the progress is seen.
#[tauri::command]
pub fn install_claude() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let script = "$host.UI.RawUI.WindowTitle = 'Installing Claude Code (Orlis Play)'; irm https://claude.ai/install.ps1 | iex; Write-Host ''; Write-Host 'Done. You can close this window and go back to Orlis Play.'";
        Command::new("powershell.exe")
            .args(["-NoLogo", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", script])
            .creation_flags(NEW_CONSOLE)
            .spawn()
            .map_err(|e| format!("Couldn't start the installer: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Only in Orlis Play for Windows.".into())
    }
}

/// Has Claude Code been signed in on this PC? Its sign-in is kept in the
/// home folder (".claude/.credentials.json", and the account in
/// ".claude.json"); or a key from the Claude Console is set.
pub fn claude_signed_in(home: &std::path::Path, api_key: Option<String>) -> bool {
    if api_key.map(|k| !k.trim().is_empty()).unwrap_or(false) {
        return true;
    }
    if home.join(".claude").join(".credentials.json").is_file() {
        return true;
    }
    std::fs::read_to_string(home.join(".claude.json")).map(|t| t.contains("\"oauthAccount\"")).unwrap_or(false)
}

/// Claude Code in a window of its own, to sign in once: the first time it
/// runs, it asks to sign in and opens Claude's sign-in page in the browser. (Only Claude Code's own path is
/// in the command - found on this PC, nothing typed by anyone.)
#[tauri::command]
pub fn claude_signin() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let claude = crate::creating::find_claude().ok_or("Claude Code isn't on this PC yet - install it first.")?;
        let path = claude.to_string_lossy().replace('\'', "''");
        let script = format!("$host.UI.RawUI.WindowTitle = 'Sign in to Claude (Orlis Play)'; Write-Host 'Claude Code asks you to sign in: choose your Claude account, then sign in on the page that opens in the browser.'; Write-Host 'Once you are signed in, close this window and go back to Orlis Play.'; Write-Host ''; & '{path}'");
        Command::new("powershell.exe")
            .args(["-NoLogo", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .creation_flags(NEW_CONSOLE)
            .spawn()
            .map_err(|e| format!("Couldn't open Claude Code: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Only in Orlis Play for Windows.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tailscale_state_in_a_word() {
        assert_eq!(tailscale_state(false, None), "missing");
        assert_eq!(tailscale_state(true, Some(br#"{"BackendState":"Running"}"#)), "on");
        assert_eq!(tailscale_state(true, Some(br#"{"BackendState":"NeedsLogin"}"#)), "signin");
        assert_eq!(tailscale_state(true, Some(br#"{"BackendState":"Stopped"}"#)), "off");
        assert_eq!(tailscale_state(true, None), "signin");
    }

    #[test]
    fn signed_in_to_claude_is_seen_in_the_home_folder() {
        let home = std::env::temp_dir().join(format!("orlis-claude-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(home.join(".claude")).unwrap();
        assert!(!claude_signed_in(&home, None));
        assert!(claude_signed_in(&home, Some("sk-ant-x".into())));
        assert!(!claude_signed_in(&home, Some("  ".into())));
        std::fs::write(home.join(".claude.json"), r#"{"numStartups":1}"#).unwrap();
        assert!(!claude_signed_in(&home, None));
        std::fs::write(home.join(".claude.json"), r#"{"oauthAccount":{"emailAddress":"a@b"}}"#).unwrap();
        assert!(claude_signed_in(&home, None));
        std::fs::remove_file(home.join(".claude.json")).unwrap();
        std::fs::write(home.join(".claude").join(".credentials.json"), "{}").unwrap();
        assert!(claude_signed_in(&home, None));
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn only_setup_pages_open() {
        assert!(allowed_link("https://tailscale.com/download/windows"));
        assert!(allowed_link("https://login.tailscale.com/a/1a2b3c4d"));
        assert!(allowed_link("https://code.claude.com/docs/en/setup"));
        assert!(!allowed_link("http://tailscale.com/download"));
        assert!(!allowed_link("https://tailscale.com.evil.example/x"));
        assert!(!allowed_link("https://example.com/"));
        assert!(!allowed_link("https://login.tailscale.com/a/x&calc"));
    }

    #[test]
    fn the_sign_in_page_is_found_in_what_tailscale_says() {
        let said = "\nTo authenticate, visit:\n\n\thttps://login.tailscale.com/a/12ab34cd\n\n";
        assert_eq!(login_url(said).as_deref(), Some("https://login.tailscale.com/a/12ab34cd"));
        assert_eq!(login_url("Success."), None);
    }
}
