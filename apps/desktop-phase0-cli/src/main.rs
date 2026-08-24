//! Portable Phase 0 benchmark executable.
//!
//! It generates explicitly labelled deterministic fixture traffic. It never
//! contacts a market-data provider and must not be used to infer production
//! throughput or data availability.

use std::env;
use std::time::Instant;

use zt_core::{EngineEvent, LocalDataEngine};
use zt_protocol::{AggressorSide, DataStatus, Environment, EventHeader, Provider, TradeEvent};
use zt_storage::{CacheBudget, CacheIndex, SegmentKey, SegmentMetadata};

const SECOND: u64 = 1_000_000_000;
const FIXTURE_TICK_SPACING_NS: u64 = 10_000;

fn parse_event_count() -> usize {
    let requested = env::args()
        .nth(1)
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(1_000_000);
    requested.clamp(1, 20_000_000)
}

fn fixture_trade(sequence: u64) -> TradeEvent {
    // Deterministic fixture-only wave. It is not market data and carries
    // `Provider::Fixture` and `Environment::Simulation` provenance.
    let tick_wave =
        ((sequence.wrapping_mul(1_103_515_245).wrapping_add(12_345) >> 16) % 401) as i64;
    TradeEvent {
        header: EventHeader::new(
            1,
            sequence,
            sequence.saturating_mul(FIXTURE_TICK_SPACING_NS),
            Provider::Fixture,
            Environment::Simulation,
            DataStatus::Live,
        ),
        symbol_id: 1,
        timestamp_ns: sequence.saturating_mul(FIXTURE_TICK_SPACING_NS),
        price_ticks: 100_000 + tick_wave,
        quantity: 1 + (sequence % 12) as i64,
        aggressor_side: if sequence.is_multiple_of(2) {
            AggressorSide::Buy
        } else {
            AggressorSide::Sell
        },
    }
}

fn main() {
    let events = parse_event_count();
    let mut engine = LocalDataEngine::new(SECOND);
    let started = Instant::now();
    let mut completed_bars = 0_u64;
    let mut gaps = 0_u64;
    let mut rejected = 0_u64;

    for sequence in 1..=events as u64 {
        match engine.ingest_trade(&fixture_trade(sequence)) {
            EngineEvent::Completed(_) => completed_bars = completed_bars.saturating_add(1),
            EngineEvent::GapDetected { .. } => gaps = gaps.saturating_add(1),
            EngineEvent::Rejected(_) => rejected = rejected.saturating_add(1),
            EngineEvent::UpdatedActiveBar | EngineEvent::Duplicate | EngineEvent::OutOfOrder => {}
        }
    }
    let ingest_elapsed = started.elapsed();

    let cache_started = Instant::now();
    let mut cache = CacheIndex::new(CacheBudget::new(32 * 1024 * 1024));
    let mut evictions = 0_u64;
    for index in 0..events.min(100_000) as u64 {
        let mutation = cache.upsert(SegmentMetadata {
            key: SegmentKey {
                symbol_id: 1,
                interval_ns: SECOND,
                start_ns: index.saturating_mul(SECOND),
            },
            bytes: 512,
            last_access: index,
            data_status: DataStatus::Live,
            // Fixture-only index benchmark: no payload is persisted here.
            content_hash: 0,
        });
        evictions = evictions.saturating_add(mutation.evicted.len() as u64);
    }
    let cache_elapsed = cache_started.elapsed();

    let seconds = ingest_elapsed.as_secs_f64();
    let events_per_second = (events as f64) / seconds.max(f64::MIN_POSITIVE);
    println!(
        concat!(
            "{{\n",
            "  \"fixture_only\": true,\n",
            "  \"events\": {events},\n",
            "  \"ingest_elapsed_ms\": {ingest_ms:.3},\n",
            "  \"ingest_events_per_second\": {events_per_second:.2},\n",
            "  \"completed_bars\": {completed_bars},\n",
            "  \"gaps_detected\": {gaps},\n",
            "  \"rejected_events\": {rejected},\n",
            "  \"cache_elapsed_ms\": {cache_ms:.3},\n",
            "  \"cache_retained_bytes\": {cache_bytes},\n",
            "  \"cache_entries\": {cache_entries},\n",
            "  \"cache_evictions\": {evictions}\n",
            "}}"
        ),
        events = events,
        ingest_ms = ingest_elapsed.as_secs_f64() * 1_000.0,
        events_per_second = events_per_second,
        completed_bars = completed_bars,
        gaps = gaps,
        rejected = rejected,
        cache_ms = cache_elapsed.as_secs_f64() * 1_000.0,
        cache_bytes = cache.retained_bytes(),
        cache_entries = cache.len(),
        evictions = evictions,
    );
}
