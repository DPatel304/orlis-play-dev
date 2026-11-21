//! Run the hub by itself, to try pads without the app:
//!   ORLIS_PAD_KEY=secret cargo run -p orlis-pad-hub --example serve -- ../../../dist-pad
use orlis_pad_hub::{Config, Hub};

#[tokio::main]
async fn main() {
    let pad_dir = std::env::args().nth(1).map(std::path::PathBuf::from);
    let cfg = Config { pad_dir, key: std::env::var("ORLIS_PAD_KEY").ok(), ..Config::default() };
    let hub = Hub::start(cfg).await.expect("could not start");
    println!("Orlis pad hub on port {}\nhost secret: {}\nhost: ws://127.0.0.1:{}/ws?role=host&key={}", hub.port, hub.key, hub.port, hub.key);
    std::future::pending::<()>().await;
}
