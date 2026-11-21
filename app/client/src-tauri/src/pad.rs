//! The pad hub, started with the app: phones join the game over the home
//! Wi-Fi as controllers (decision 0027, docs/specs/pad-protocol.md). The hub
//! itself is the `orlis-pad-hub` crate (pad-hub/); this is the glue.
//!
//!   pad_hub_info   { port, key } for the game's window, or null if the hub
//!                  could not start (the game then runs without phones)
//!
//! The game's window is also told by itself: window.__ORLIS_PAD_HUB__ =
//! { port, key } is set before the game starts (src/session/host-link.js).
//! The pad page is the built `dist-pad/` folder, carried in the app as a
//! resource; a game's pad program comes from its own folder (`pad/`) in
//! Documents\Orlis Play\Games, or from a `pads` resource folder.

use orlis_pad_hub::{Config, Hub, PadSource};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct PadHub(Mutex<Option<Hub>>);

/// Start the hub (once). If it cannot, say so in the log and carry on.
pub fn start(app: &AppHandle) {
    let resources = app.path().resource_dir().ok();
    let mut game_sources = Vec::new();
    if let Ok(docs) = app.path().document_dir() {
        game_sources.push(PadSource { root: docs.join("Orlis Play").join("Games"), sub: "pad" });
    }
    if let Some(r) = &resources {
        game_sources.push(PadSource { root: r.join("pads"), sub: "" });
    }
    let cfg = Config { pad_dir: resources.map(|r| r.join("dist-pad")), game_sources, ..Config::default() };
    match tauri::async_runtime::block_on(Hub::start(cfg)) {
        Ok(hub) => {
            eprintln!("pad hub on port {}", hub.port);
            *app.state::<PadHub>().0.lock().unwrap() = Some(hub);
        }
        Err(e) => eprintln!("could not start the pad hub: {e}"),
    }
}

fn info(app: &AppHandle) -> Value {
    match &*app.state::<PadHub>().0.lock().unwrap() {
        Some(h) => json!({ "port": h.port, "key": h.key }),
        None => Value::Null,
    }
}

/// The script that tells the game's window where the hub is.
pub fn init_script(app: &AppHandle) -> String {
    match info(app) {
        Value::Null => String::new(),
        // The key is the host secret. Tauri runs initialization scripts in the main frame only, and downloaded games run in
        // sandboxed iframes whose CSP blocks WebSockets; the top-window check is a second guard.
        v => format!("if (window === window.top) window.__ORLIS_PAD_HUB__ = {v};"),
    }
}

/// Where the hub is: `{ port, key }`, or null.
#[tauri::command]
pub fn pad_hub_info(app: AppHandle) -> Value {
    info(&app)
}
