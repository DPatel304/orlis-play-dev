//! The same scenarios as app/test/pad-hub.node.mjs, against the Rust hub over real WebSockets on localhost.

use futures_util::{SinkExt, StreamExt};
use orlis_pad_hub::{close, Config, Hub, PadSource, MAX_MESSAGE, MAX_PADS};
use serde_json::{json, Value};
use std::{
    net::{IpAddr, Ipv4Addr},
    path::PathBuf,
    sync::atomic::Ordering::Relaxed,
    time::Duration,
};
use tokio::time::{sleep, timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

const KEY: &str = "test-secret";
type Ws = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

async fn hub_with(f: impl FnOnce(&mut Config)) -> Hub {
    let mut c = Config { port: 0, bind: IpAddr::V4(Ipv4Addr::LOCALHOST), key: Some(KEY.into()), ..Config::default() };
    f(&mut c);
    Hub::start(c).await.unwrap()
}
async fn hub() -> Hub {
    hub_with(|_| {}).await
}

async fn connect(h: &Hub, query: &str) -> Result<Ws, tokio_tungstenite::tungstenite::Error> {
    connect_async(format!("ws://127.0.0.1:{}/ws?{query}", h.port)).await.map(|(w, _)| w)
}
async fn host(h: &Hub) -> Ws {
    connect(h, &format!("role=host&key={KEY}")).await.unwrap()
}
async fn pad(h: &Hub) -> Ws {
    connect(h, "role=pad").await.unwrap()
}

/// The next JSON message, or the close code.
#[derive(Debug)]
enum Got {
    Json(Value),
    Closed(u16),
    Silent,
}
async fn next(w: &mut Ws, ms: u64) -> Got {
    loop {
        match timeout(Duration::from_millis(ms), w.next()).await {
            Err(_) => return Got::Silent,
            Ok(None) => return Got::Closed(1006),
            Ok(Some(Err(_))) => return Got::Closed(1006),
            Ok(Some(Ok(Message::Text(t)))) => return Got::Json(serde_json::from_str(t.as_str()).unwrap()),
            Ok(Some(Ok(Message::Close(f)))) => return Got::Closed(f.map(|f| u16::from(f.code)).unwrap_or(1005)),
            Ok(Some(Ok(_))) => continue,
        }
    }
}
async fn json_of(w: &mut Ws) -> Value {
    match next(w, 2000).await {
        Got::Json(v) => v,
        other => panic!("wanted a message, got {other:?}"),
    }
}
async fn closed_with(w: &mut Ws) -> u16 {
    loop {
        match next(w, 2000).await {
            Got::Closed(c) => return c,
            Got::Json(_) => continue,
            Got::Silent => panic!("it was not closed"),
        }
    }
}
async fn send(w: &mut Ws, v: Value) {
    w.send(Message::Text(v.to_string().into())).await.unwrap();
}
async fn until(mut f: impl FnMut() -> bool) -> bool {
    for _ in 0..300 {
        if f() {
            return true;
        }
        sleep(Duration::from_millis(10)).await;
    }
    false
}

#[tokio::test]
async fn the_hub_relays_both_ways_with_the_spec_shapes() {
    let h = hub().await;
    let mut ho = host(&h).await;
    let mut a = pad(&h).await;
    let mut b = pad(&h).await;
    let o1 = json_of(&mut ho).await;
    assert_eq!((o1["t"].as_str(), o1["from"].as_str()), (Some("open"), Some("c1")));
    assert!(o1["ua"].is_string());
    assert_eq!(json_of(&mut ho).await["from"], "c2");
    send(&mut a, json!({"t": "in", "seq": 7, "x": 0.4})).await;
    assert_eq!(json_of(&mut ho).await, json!({"t": "msg", "from": "c1", "m": {"t": "in", "seq": 7, "x": 0.4}}));
    // to one pad
    send(&mut ho, json!({"to": "c2", "m": {"t": "state", "tick": 1}})).await;
    assert_eq!(json_of(&mut b).await["tick"], 1);
    assert!(matches!(next(&mut a, 150).await, Got::Silent), "only c2 heard it");
    // to all
    send(&mut ho, json!({"to": "*", "m": {"t": "pause", "why": "seat"}})).await;
    assert_eq!(json_of(&mut a).await["t"], "pause");
    assert_eq!(json_of(&mut b).await["t"], "pause");
    // close one
    send(&mut ho, json!({"to": "c1", "close": true})).await;
    assert_eq!(closed_with(&mut a).await, close::NORMAL);
    assert_eq!(json_of(&mut ho).await, json!({"t": "close", "from": "c1"}));
    assert!(matches!(next(&mut b, 100).await, Got::Silent));
    // a pad that leaves is reported
    drop(b);
    assert_eq!(json_of(&mut ho).await, json!({"t": "close", "from": "c2"}));
    assert!(until(|| h.pad_count() == 0).await);
    h.stop();
}

#[tokio::test]
async fn a_closed_pad_id_is_not_reused() {
    let h = hub().await;
    let mut ho = host(&h).await;
    let mut a = pad(&h).await;
    assert_eq!(json_of(&mut ho).await["from"], "c1");
    a.close(None).await.ok();
    assert_eq!(json_of(&mut ho).await["t"], "close");
    let _b = pad(&h).await;
    assert_eq!(json_of(&mut ho).await["from"], "c2");
    h.stop();
}

#[tokio::test]
async fn the_host_needs_the_secret_and_a_second_host_replaces_the_first() {
    let h = hub().await;
    assert!(connect(&h, "role=host&key=wrong").await.is_err(), "wrong secret");
    assert!(connect(&h, "role=host").await.is_err(), "no secret");
    assert!(connect(&h, "role=nobody").await.is_err(), "unknown role");
    assert!(connect(&h, "").await.is_err(), "no role");
    let mut one = host(&h).await;
    let mut a = pad(&h).await;
    assert_eq!(json_of(&mut one).await["from"], "c1");
    let mut two = host(&h).await;
    assert_eq!(closed_with(&mut one).await, close::REPLACED);
    assert_eq!(json_of(&mut two).await["from"], "c1", "the new host learns who is here");
    assert!(matches!(next(&mut a, 150).await, Got::Silent), "the pad was not dropped");
    assert_eq!(h.pad_count(), 1);
    send(&mut a, json!({"t": "in", "seq": 1})).await;
    assert_eq!(json_of(&mut two).await["t"], "msg", "its messages go to the new host");
    assert_eq!(h.stats().hosts_replaced.load(Relaxed), 1);
    h.stop();
}

#[tokio::test]
async fn with_no_host_pads_are_refused_and_when_the_host_leaves_every_pad_is_closed() {
    let h = hub().await;
    let mut early = pad(&h).await;
    assert_eq!(closed_with(&mut early).await, close::NO_GAME);
    let mut ho = host(&h).await;
    let mut a = pad(&h).await;
    let mut b = pad(&h).await;
    json_of(&mut ho).await;
    json_of(&mut ho).await;
    assert!(until(|| h.pad_count() == 2).await);
    drop(ho);
    assert_eq!(closed_with(&mut a).await, close::NO_GAME);
    assert_eq!(closed_with(&mut b).await, close::NO_GAME);
    assert!(until(|| h.pad_count() == 0 && !h.has_host()).await);
    // still refused, and a new host works again
    let mut c = pad(&h).await;
    assert_eq!(closed_with(&mut c).await, close::NO_GAME);
    let mut ho2 = host(&h).await;
    let mut d = pad(&h).await;
    assert_eq!(json_of(&mut ho2).await["t"], "open");
    send(&mut d, json!({"t": "ping", "n": 1})).await;
    assert_eq!(json_of(&mut ho2).await["m"]["t"], "ping");
    h.stop();
}

#[tokio::test]
async fn there_is_room_for_16_pads_and_the_17th_gets_4003() {
    let h = hub().await;
    let _ho = host(&h).await;
    let mut pads = Vec::new();
    for _ in 0..MAX_PADS {
        pads.push(pad(&h).await);
    }
    assert!(until(|| h.pad_count() == MAX_PADS).await);
    let mut extra = pad(&h).await;
    assert_eq!(closed_with(&mut extra).await, close::FULL);
    assert_eq!(h.pad_count(), MAX_PADS);
    assert_eq!(h.stats().refused_full.load(Relaxed), 1);
    h.stop();
}

#[tokio::test]
async fn oversized_and_too_fast_messages_are_dropped_and_junk_closes_that_pad_only() {
    let h = hub().await;
    let mut ho = host(&h).await;
    let mut a = pad(&h).await;
    json_of(&mut ho).await;
    // oversized: dropped, the pad stays, the next one arrives
    send(&mut a, json!({"t": "in", "seq": 1, "pad": "x".repeat(MAX_MESSAGE + 100)})).await;
    send(&mut a, json!({"t": "in", "seq": 2})).await;
    assert_eq!(json_of(&mut ho).await["m"]["seq"], 2);
    assert_eq!(h.stats().dropped_big.load(Relaxed), 1);
    // just under the limit is let through
    let ok = json!({"t": "in", "seq": 3, "pad": "x".repeat(MAX_MESSAGE - 40)});
    assert!(ok.to_string().len() <= MAX_MESSAGE);
    send(&mut a, ok).await;
    assert_eq!(json_of(&mut ho).await["m"]["seq"], 3);
    // too fast: about a second's worth (the bucket was nearly full) gets through, the rest are dropped
    for i in 0..300 {
        send(&mut a, json!({"t": "in", "seq": 1000 + i})).await;
    }
    assert!(until(|| h.stats().relayed.load(Relaxed) + h.stats().dropped_fast.load(Relaxed) >= 2 + 300 - 1).await);
    sleep(Duration::from_millis(100)).await;
    let mut relayed = 0;
    while let Got::Json(v) = next(&mut ho, 100).await {
        if v["m"]["seq"].as_i64().unwrap_or(0) >= 1000 {
            relayed += 1;
        }
    }
    assert!((50..=90).contains(&relayed), "about a second's worth got through ({relayed})");
    assert!(h.stats().dropped_fast.load(Relaxed) >= 200);
    // junk: not JSON; JSON that is not an object; a binary frame
    let mut bad = pad(&h).await;
    bad.send(Message::Text("this is not json".into())).await.unwrap();
    assert_eq!(closed_with(&mut bad).await, close::BAD_DATA);
    let mut arr = pad(&h).await;
    arr.send(Message::Text("[1,2,3]".into())).await.unwrap();
    assert_eq!(closed_with(&mut arr).await, close::BAD_DATA);
    let mut bin = pad(&h).await;
    bin.send(Message::Binary(vec![1, 2, 3].into())).await.unwrap();
    assert_eq!(closed_with(&mut bin).await, close::BAD_DATA);
    assert_eq!(h.stats().closed_bad_json.load(Relaxed), 2);
    // the first pad was never affected, and the hub still serves
    assert!(until(|| h.pad_count() == 1).await);
    h.stop();
}

#[tokio::test]
async fn a_pad_gets_the_close_code_the_host_asks_for() {
    let h = hub().await;
    let mut ho = host(&h).await;
    let mut a = pad(&h).await;
    json_of(&mut ho).await;
    send(&mut ho, json!({"to": "c1", "close": true, "code": 4003, "reason": "full"})).await;
    assert_eq!(closed_with(&mut a).await, 4003);
    h.stop();
}

fn temp_dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("orlis-pad-hub-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

async fn get(h: &Hub, path: &str) -> (u16, String, String) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut s = tokio::net::TcpStream::connect(("127.0.0.1", h.port)).await.unwrap();
    s.write_all(format!("GET {path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n").as_bytes()).await.unwrap();
    let mut buf = Vec::new();
    s.read_to_end(&mut buf).await.unwrap();
    let text = String::from_utf8_lossy(&buf).into_owned();
    let (head, body) = text.split_once("\r\n\r\n").unwrap_or((&text, ""));
    let status = head.split(' ').nth(1).unwrap().parse().unwrap();
    let ctype = head.lines().find_map(|l| l.to_ascii_lowercase().strip_prefix("content-type:").map(|v| v.trim().to_string())).unwrap_or_default();
    (status, ctype, body.to_string())
}

#[tokio::test]
async fn it_serves_the_pad_page_and_a_games_pad_program() {
    let root = temp_dir("files");
    let page = root.join("dist-pad");
    std::fs::create_dir_all(page.join("assets")).unwrap();
    std::fs::write(page.join("index.html"), "<p>pad page</p>").unwrap();
    std::fs::write(page.join("assets/a.js"), "export default 1;").unwrap();
    // a built-in game's pad program in the resources, and an installed game's in its folder
    std::fs::create_dir_all(root.join("pads/pop-party")).unwrap();
    std::fs::write(root.join("pads/pop-party/pad.js"), "export default 2;").unwrap();
    std::fs::create_dir_all(root.join("Games/My game/pad")).unwrap();
    std::fs::write(root.join("Games/My game/pad/index.html"), "<p>mine</p>").unwrap();
    std::fs::write(root.join("secret.txt"), "no").unwrap();
    let sources = vec![PadSource { root: root.join("Games"), sub: "pad" }, PadSource { root: root.join("pads"), sub: "" }];
    let h = hub_with(|c| {
        c.pad_dir = Some(page.clone());
        c.game_sources = sources;
    })
    .await;

    let (s, t, body) = get(&h, "/").await;
    assert_eq!((s, body.as_str()), (200, "<p>pad page</p>"));
    assert!(t.contains("html"));
    let (s, t, _) = get(&h, "/assets/a.js").await;
    assert_eq!(s, 200);
    assert!(t.contains("javascript"));
    let (s, t, _) = get(&h, "/pads/pop-party/pad.js").await;
    assert_eq!(s, 200);
    assert!(t.contains("javascript"));
    assert_eq!(get(&h, "/pads/My%20game/").await.2, "<p>mine</p>");
    assert_eq!(get(&h, "/pads/nope/pad.js").await.0, 404);
    assert_eq!(get(&h, "/nope.html").await.0, 404);
    // no way out of the folders
    assert_eq!(get(&h, "/%2e%2e/secret.txt").await.0, 404);
    assert_eq!(get(&h, "/../secret.txt").await.0, 404);
    assert_eq!(get(&h, "/pads/pop-party/..%2f..%2fsecret.txt").await.0, 404);
    assert_eq!(get(&h, "/pads/pop-party/%2e%2e/%2e%2e/secret.txt").await.0, 404);
    h.stop();
    let _ = std::fs::remove_dir_all(root);
}

#[tokio::test]
async fn without_a_built_pad_page_it_says_so() {
    let h = hub().await;
    let (s, _, body) = get(&h, "/").await;
    assert_eq!(s, 200);
    assert!(body.contains("not built yet"));
    h.stop();
}

#[tokio::test]
async fn if_the_first_port_is_busy_the_hub_tries_the_next_ones() {
    let a = hub().await;
    let first = a.port;
    let b = hub_with(|c| c.port = first).await;
    assert!(b.port > first && b.port <= first + 9, "{}", b.port);
    let c = hub_with(|c| c.port = first).await;
    assert!(c.port > b.port && c.port <= first + 9, "{}", c.port);
    // without the fallback a busy port is an error
    let cfg = Config { port: first, bind: IpAddr::V4(Ipv4Addr::LOCALHOST), fallback: false, key: Some(KEY.into()), ..Config::default() };
    assert!(Hub::start(cfg).await.is_err());
    for h in [&a, &b, &c] {
        h.stop();
    }
}

#[tokio::test]
async fn a_made_up_key_works_and_the_old_one_does_not() {
    let h = hub_with(|c| c.key = None).await;
    assert_eq!(h.key.len(), 32);
    assert!(connect(&h, &format!("role=host&key={}", h.key)).await.is_ok());
    assert!(connect(&h, &format!("role=host&key={KEY}")).await.is_err());
    h.stop();
}
