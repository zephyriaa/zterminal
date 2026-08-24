//! Bounded credential-free direct public Binance aggregate-trade probe.
//!
//! The example exists only to verify a local network path. It performs no
//! account operation, provider fallback, persistence, or trading action.

use zt_adapters::live_public::collect_binance_aggregate_trade_probe;
use zt_adapters::{PublicProvider, PublicTradeSubscription};

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let subscription = PublicTradeSubscription {
        provider: PublicProvider::BinanceSpot,
        symbol_id: 1,
        provider_symbol: "btcusdt",
        price_scale: 100,
        quantity_scale: 1_000_000,
        stream_id: 1,
    };
    match collect_binance_aggregate_trade_probe(subscription, 3).await {
        Ok(events) => println!("direct_public_events={events:?}"),
        Err(error) => {
            eprintln!("direct_public_probe_failed={error:?}");
            std::process::exit(1);
        }
    }
}
