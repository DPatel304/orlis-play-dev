//! The pad hub of Orlis Play (plan package P2; spec: docs/specs/pad-protocol.md).
//!
//! The same job as the Node copy in tools/pad-hub.mjs, which it must keep
//! behaving like: it relays and nothing more.
//!
//! ```text
//!   phone (pad page) --ws://BOX:47880/ws?role=pad-----------------------+
//!   game host (WebView JS) --ws://127.0.0.1:47880/ws?role=host&key=K----+--> hub
//! ```
//!
//! - `GET /` serves the pad page (the built `dist-pad/`); `GET /pads/<game>/...`
//!   serves a game's pad program.
//! - `/ws?role=host&key=K`: the game. One at a time (a second replaces the
//!   first, close code 4002); K must match; only from this computer.
//! - `/ws?role=pad`: a phone. Gets an id (c1, c2, ...). Refused with 4001
//!   ("no game running") when there is no host, and with 4003 when 16 are in.
//! - To the host: `{"t":"open","from":"c3","ua":"..."}`, `{"t":"close","from":"c3"}`,
//!   `{"t":"msg","from":"c3","m":<the pad's message>}`.
//! - From the host: `{"to":"c3"|"*","m":<message>}`; `{"to":"c3","close":true}`
//!   closes that pad.
//! - Limits: 16 pads, 16 KB a message, 60 messages a second per pad (extras are
//!   dropped); a pad that sends something that is not a JSON object is closed
//!   with 1003. When the host goes, every pad is closed with 4001.

use axum::{
    extract::{
        ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, RawQuery, State,
    },
    http::{header, HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering::Relaxed},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tokio::{
    net::TcpListener,
    sync::{mpsc, watch},
    task::JoinHandle,
};

/// The first port tried; if busy, the next nine.
pub const DEFAULT_PORT: u16 = 47880;
pub const MAX_PADS: usize = 16;
/// The biggest message a pad may send, in bytes.
pub const MAX_MESSAGE: usize = 16 * 1024;
/// Messages a second per pad.
pub const PER_SECOND: f64 = 60.0;
/// The biggest frame the hub reads at all (past this the connection closes, 1009).
pub const MAX_FRAME: usize = 1024 * 1024;

/// Close codes (docs/specs/pad-protocol.md).
pub mod close {
    pub const NORMAL: u16 = 1000;
    pub const BAD_DATA: u16 = 1003;
    pub const NO_GAME: u16 = 4001;
    pub const REPLACED: u16 = 4002;
    pub const FULL: u16 = 4003;
}

/// Where a game's pad program may be: `<root>/<game>/<sub>/<file>` (`sub`
/// may be empty).
#[derive(Clone, Debug)]
pub struct PadSource {
    pub root: PathBuf,
    pub sub: &'static str,
}

#[derive(Clone, Debug)]
pub struct Config {
    /// First port to try (0: any free one, no fallback).
    pub port: u16,
    pub bind: IpAddr,
    /// The host's secret; made up if left out.
    pub key: Option<String>,
    /// The built pad page (`dist-pad/`).
    pub pad_dir: Option<PathBuf>,
    /// Where `/pads/<game>/...` is looked for, in order.
    pub game_sources: Vec<PadSource>,
    /// Try the next nine ports when the first is busy.
    pub fallback: bool,
    /// The host may connect only from this computer.
    pub loopback_host: bool,
    pub per_second: f64,
    pub max_pads: usize,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            port: DEFAULT_PORT,
            bind: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            key: None,
            pad_dir: None,
            game_sources: Vec::new(),
            fallback: true,
            loopback_host: true,
            per_second: PER_SECOND,
            max_pads: MAX_PADS,
        }
    }
}

/// What happened, for tests and for a look at how it is going.
#[derive(Default)]
pub struct Stats {
    pub pads_opened: AtomicU64,
    pub relayed: AtomicU64,
    pub dropped_big: AtomicU64,
    pub dropped_fast: AtomicU64,
    pub closed_bad_json: AtomicU64,
    pub refused_no_host: AtomicU64,
    pub refused_full: AtomicU64,
    pub hosts_replaced: AtomicU64,
}

enum Out {
    Text(String),
    Close(u16, String),
}

struct HostPeer {
    conn: u64,
    tx: mpsc::UnboundedSender<Out>,
}

struct PadPeer {
    tx: mpsc::UnboundedSender<Out>,
    ua: String,
}

#[derive(Default)]
struct Inner {
    host: Option<HostPeer>,
    pads: BTreeMap<u64, PadPeer>,
    next_pad: u64,
}

struct Shared {
    key: String,
    cfg: Config,
    inner: Mutex<Inner>,
    stats: Stats,
    next_conn: AtomicU64,
    down: watch::Sender<bool>,
}

impl Shared {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn to_host(inner: &Inner, v: Value) {
        if let Some(h) = &inner.host {
            let _ = h.tx.send(Out::Text(v.to_string()));
        }
    }

    /// A pad leaves (it closed, or it is being closed): forget it and tell
    /// the host. `close` is the frame to send it, if it is still connected.
    fn drop_pad(&self, id: u64, close: Option<(u16, &str)>) {
        let mut g = self.lock();
        if let Some(p) = g.pads.remove(&id) {
            if let Some((code, why)) = close {
                let _ = p.tx.send(Out::Close(code, why.to_string()));
            }
            Self::to_host(&g, json!({ "t": "close", "from": format!("c{id}") }));
        }
    }

    fn add_host(&self, conn: u64, tx: mpsc::UnboundedSender<Out>) {
        let mut g = self.lock();
        if let Some(old) = g.host.take() {
            self.stats.hosts_replaced.fetch_add(1, Relaxed);
            let _ = old.tx.send(Out::Close(close::REPLACED, "replaced".into()));
        }
        g.host = Some(HostPeer { conn, tx });
        // a new host learns who is already here
        for (id, p) in g.pads.iter() {
            Self::to_host(&g, json!({ "t": "open", "from": format!("c{id}"), "ua": p.ua }));
        }
    }

    /// The host is gone: every pad is closed with 4001 (unless it was replaced).
    fn host_gone(&self, conn: u64) {
        let mut g = self.lock();
        if g.host.as_ref().map(|h| h.conn) != Some(conn) {
            return;
        }
        g.host = None;
        for (_, p) in std::mem::take(&mut g.pads) {
            let _ = p.tx.send(Out::Close(close::NO_GAME, "no game running".into()));
        }
    }

    /// A new pad: its id, or `Err` with the close to send.
    fn add_pad(&self, tx: mpsc::UnboundedSender<Out>, ua: String) -> Result<u64, (u16, &'static str)> {
        let mut g = self.lock();
        if g.host.is_none() {
            self.stats.refused_no_host.fetch_add(1, Relaxed);
            return Err((close::NO_GAME, "no game running"));
        }
        if g.pads.len() >= self.cfg.max_pads {
            self.stats.refused_full.fetch_add(1, Relaxed);
            return Err((close::FULL, "full"));
        }
        g.next_pad += 1;
        let id = g.next_pad;
        self.stats.pads_opened.fetch_add(1, Relaxed);
        Self::to_host(&g, json!({ "t": "open", "from": format!("c{id}"), "ua": ua }));
        g.pads.insert(id, PadPeer { tx, ua });
        Ok(id)
    }

    fn from_pad(&self, id: u64, m: Value) {
        let g = self.lock();
        if !g.pads.contains_key(&id) {
            return;
        }
        self.stats.relayed.fetch_add(1, Relaxed);
        Self::to_host(&g, json!({ "t": "msg", "from": format!("c{id}"), "m": m }));
    }

    fn from_host(&self, text: &str) {
        let Ok(Value::Object(m)) = serde_json::from_str::<Value>(text) else { return };
        let pad_id = |s: &str| s.strip_prefix('c').and_then(|n| n.parse::<u64>().ok());
        let Some(to) = m.get("to").and_then(|t| t.as_str()) else { return };
        if m.get("close") == Some(&Value::Bool(true)) {
            let code = m.get("code").and_then(|c| c.as_u64()).filter(|c| *c <= u16::MAX as u64).map(|c| c as u16).unwrap_or(close::NORMAL);
            let why = m.get("reason").and_then(|r| r.as_str()).unwrap_or("").to_string();
            if let Some(id) = pad_id(to) {
                self.drop_pad(id, Some((code, &why)));
            }
            return;
        }
        let Some(msg) = m.get("m") else { return };
        let s = msg.to_string();
        let g = self.lock();
        if to == "*" {
            for p in g.pads.values() {
                let _ = p.tx.send(Out::Text(s.clone()));
            }
        } else if let Some(p) = pad_id(to).and_then(|id| g.pads.get(&id)) {
            let _ = p.tx.send(Out::Text(s));
        }
    }
}

/// The running hub. Dropping it does not stop it: call [`Hub::stop`].
pub struct Hub {
    pub port: u16,
    pub key: String,
    shared: Arc<Shared>,
    task: JoinHandle<()>,
}

impl Hub {
    pub async fn start(cfg: Config) -> std::io::Result<Hub> {
        let key = cfg.key.clone().unwrap_or_else(make_key);
        let (listener, port) = listen(&cfg).await?;
        let (down, _) = watch::channel(false);
        let shared = Arc::new(Shared { key: key.clone(), cfg, inner: Mutex::new(Inner::default()), stats: Stats::default(), next_conn: AtomicU64::new(1), down });
        let app = Router::new().route("/ws", get(ws_route)).fallback(files).with_state(shared.clone());
        let task = tokio::spawn(async move {
            let _ = axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await;
        });
        Ok(Hub { port, key, shared, task })
    }

    pub fn stats(&self) -> &Stats {
        &self.shared.stats
    }
    pub fn pad_count(&self) -> usize {
        self.shared.lock().pads.len()
    }
    pub fn has_host(&self) -> bool {
        self.shared.lock().host.is_some()
    }

    /// Stop listening and drop every connection.
    pub fn stop(&self) {
        let _ = self.shared.down.send(true);
        self.task.abort();
    }
}

fn make_key() -> String {
    let mut b = [0u8; 16];
    if getrandom::fill(&mut b).is_err() {
        // (no system randomness: fall back on the clock and the address of a local)
        let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
        b = (t ^ (&b as *const _ as usize as u128).rotate_left(64)).to_le_bytes();
    }
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// Port 47880, then 47881 to 47889 if busy.
async fn listen(cfg: &Config) -> std::io::Result<(TcpListener, u16)> {
    let ports: Vec<u16> = if cfg.fallback && cfg.port != 0 { (cfg.port..=cfg.port.saturating_add(9)).collect() } else { vec![cfg.port] };
    let mut last = None;
    for p in ports {
        match TcpListener::bind(SocketAddr::new(cfg.bind, p)).await {
            Ok(l) => {
                let port = l.local_addr()?.port();
                return Ok((l, port));
            }
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => last = Some(e),
            Err(e) => return Err(e),
        }
    }
    Err(last.unwrap_or_else(|| std::io::Error::other("no port")))
}

/* ---------- WebSocket ---------- */

#[derive(Clone, Copy, PartialEq)]
enum Role {
    Pad,
    Host,
}

fn query_param(q: &str, name: &str) -> Option<String> {
    q.split('&').filter_map(|kv| kv.split_once('=')).find(|(k, _)| *k == name).map(|(_, v)| percent_decode(v))
}

/// The game's own window is on this computer; a phone is not allowed to be the host.
fn host_allowed(ip: IpAddr, loopback_only: bool) -> bool {
    !loopback_only || ip.to_canonical().is_loopback()
}

fn same_key(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |d, (x, y)| d | (x ^ y)) == 0
}

async fn ws_route(
    State(st): State<Arc<Shared>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    RawQuery(q): RawQuery,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    let q = q.unwrap_or_default();
    let role = match query_param(&q, "role").as_deref() {
        Some("pad") => Role::Pad,
        Some("host") => Role::Host,
        _ => return StatusCode::BAD_REQUEST.into_response(),
    };
    if role == Role::Host {
        let keyed = same_key(&query_param(&q, "key").unwrap_or_default(), &st.key);
        if !keyed || !host_allowed(addr.ip(), st.cfg.loopback_host) {
            return StatusCode::UNAUTHORIZED.into_response();
        }
    }
    let ua: String = headers.get(header::USER_AGENT).and_then(|v| v.to_str().ok()).unwrap_or("").chars().take(200).collect();
    ws.max_message_size(MAX_FRAME).max_frame_size(MAX_FRAME).on_upgrade(move |socket| connection(socket, st, role, ua))
}

async fn connection(mut socket: WebSocket, st: Arc<Shared>, role: Role, ua: String) {
    let (tx, mut rx) = mpsc::unbounded_channel::<Out>();
    let conn = st.next_conn.fetch_add(1, Relaxed);
    let mut pad_id = 0u64;
    match role {
        Role::Host => st.add_host(conn, tx.clone()),
        Role::Pad => match st.add_pad(tx.clone(), ua) {
            Ok(id) => pad_id = id,
            Err((code, why)) => {
                let _ = tx.send(Out::Close(code, why.into()));
            }
        },
    }
    let mut down = st.down.subscribe();
    let mut tokens = st.cfg.per_second;
    let mut stamp = Instant::now();
    let mut closing: Option<Instant> = None;
    loop {
        let linger = async {
            match closing {
                Some(t) => tokio::time::sleep_until(t.into()).await,
                None => std::future::pending().await,
            }
        };
        tokio::select! {
            _ = down.changed() => break,
            _ = linger => break,
            out = rx.recv(), if closing.is_none() => match out {
                Some(Out::Text(t)) => { if socket.send(Message::Text(t.into())).await.is_err() { break; } }
                Some(Out::Close(code, why)) => {
                    let why: String = why.chars().take(100).collect();
                    let _ = socket.send(Message::Close(Some(CloseFrame { code, reason: why.into() }))).await;
                    // wait a moment for the other side's close, then let go
                    closing = Some(Instant::now() + Duration::from_secs(1));
                }
                None => break,
            },
            msg = socket.recv() => {
                let Some(Ok(msg)) = msg else { break };
                if closing.is_some() {
                    if matches!(msg, Message::Close(_)) { break; }
                    continue;
                }
                match msg {
                    Message::Close(_) => break,
                    Message::Ping(_) | Message::Pong(_) => {}
                    Message::Binary(_) => {
                        // text only
                        let _ = tx.send(Out::Close(close::BAD_DATA, "text only".into()));
                    }
                    Message::Text(t) => match role {
                        Role::Host => st.from_host(t.as_str()),
                        Role::Pad => {
                            if t.as_str().len() > MAX_MESSAGE { st.stats.dropped_big.fetch_add(1, Relaxed); continue; }
                            // a bucket that refills; extras are dropped
                            let now = Instant::now();
                            tokens = (tokens + now.duration_since(stamp).as_secs_f64() * st.cfg.per_second).min(st.cfg.per_second);
                            stamp = now;
                            if tokens < 1.0 { st.stats.dropped_fast.fetch_add(1, Relaxed); continue; }
                            tokens -= 1.0;
                            match serde_json::from_str::<Value>(t.as_str()) {
                                Ok(m @ Value::Object(_)) => st.from_pad(pad_id, m),
                                _ => {
                                    st.stats.closed_bad_json.fetch_add(1, Relaxed);
                                    st.drop_pad(pad_id, Some((close::BAD_DATA, "not JSON")));
                                }
                            }
                        }
                    },
                }
            }
        }
    }
    match role {
        Role::Host => st.host_gone(conn),
        Role::Pad => st.drop_pad(pad_id, None),
    }
}

/* ---------- the pad page and the games' pad programs ---------- */

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn content_type(p: &std::path::Path) -> &'static str {
    match p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("woff2") => "font/woff2",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("wasm") => "application/wasm",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// Path segments of a URL path with no way out of a folder: None if any is unsafe.
fn safe_segments(path: &str) -> Option<Vec<String>> {
    let decoded = percent_decode(path);
    let mut segs = Vec::new();
    for s in decoded.split('/') {
        if s.is_empty() || s == "." {
            continue;
        }
        if s == ".." || s.contains(['\\', ':', '\0']) {
            return None;
        }
        segs.push(s.to_string());
    }
    Some(segs)
}

async fn files(State(st): State<Arc<Shared>>, uri: Uri) -> Response {
    let not_found = || (StatusCode::NOT_FOUND, [(header::CONTENT_TYPE, "text/plain; charset=utf-8")], "Not found").into_response();
    let Some(segs) = safe_segments(uri.path()) else { return not_found() };
    let dir_url = uri.path().ends_with('/') || segs.is_empty();
    let mut candidates: Vec<PathBuf> = Vec::new();
    if segs.first().map(String::as_str) == Some("pads") {
        if segs.len() < 2 {
            return not_found();
        }
        let game = &segs[1];
        for src in &st.cfg.game_sources {
            let mut p = src.root.join(game);
            if !src.sub.is_empty() {
                p.push(src.sub);
            }
            p.extend(&segs[2..]);
            candidates.push(p);
        }
    } else if let Some(root) = &st.cfg.pad_dir {
        let mut p = root.clone();
        p.extend(&segs);
        candidates.push(p);
    }
    for mut p in candidates {
        if dir_url || p.is_dir() {
            p.push("index.html");
        }
        if let Ok(bytes) = tokio::fs::read(&p).await {
            return ([(header::CONTENT_TYPE, content_type(&p)), (header::CACHE_CONTROL, "no-store")], bytes).into_response();
        }
    }
    if segs.is_empty() || (segs.len() == 1 && segs[0] == "index.html") {
        if st.cfg.pad_dir.is_none() {
            return ([(header::CONTENT_TYPE, "text/html; charset=utf-8")], "<!doctype html><meta charset=\"utf-8\"><title>Orlis pad</title><p>The pad page is not built yet.").into_response();
        }
    }
    not_found()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_host_is_allowed_only_from_this_computer() {
        let lan: IpAddr = "192.168.1.20".parse().unwrap();
        assert!(host_allowed("127.0.0.1".parse().unwrap(), true));
        assert!(host_allowed("::1".parse().unwrap(), true));
        assert!(host_allowed("::ffff:127.0.0.1".parse().unwrap(), true));
        assert!(!host_allowed(lan, true));
        assert!(!host_allowed("::ffff:192.168.1.20".parse().unwrap(), true));
        assert!(host_allowed(lan, false));
    }

    #[test]
    fn the_key_is_compared_whole() {
        assert!(same_key("abc", "abc"));
        assert!(!same_key("abc", "abd"));
        assert!(!same_key("abc", "ab"));
        assert!(!same_key("", "abc"));
    }

    #[test]
    fn made_up_keys_are_long_and_different() {
        let (a, b) = (make_key(), make_key());
        assert_eq!(a.len(), 32);
        assert_ne!(a, b);
    }

    #[test]
    fn paths_cannot_leave_the_folder() {
        assert_eq!(safe_segments("/pads/x/pad.js").unwrap(), vec!["pads", "x", "pad.js"]);
        assert!(safe_segments("/%2e%2e/etc/passwd").is_none());
        assert!(safe_segments("/a/../b").is_none());
        assert!(safe_segments("/a\\b").is_none());
        assert!(safe_segments("/C:/x").is_none());
        assert_eq!(safe_segments("/").unwrap().len(), 0);
    }
}
