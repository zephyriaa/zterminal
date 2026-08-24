//! Direct, local, public-market adapter contracts.
//!
//! This crate normalizes provider-shaped frames without creating sockets,
//! storing credentials, selecting fallback providers, or exposing execution.
//! The native host owns the eventual transport and must only pass received bytes
//! into an explicitly selected adapter.

use serde::Deserialize;
use zt_core::{
    encode_local_bar_segment, CompletedBar, EngineEvent, LocalDataEngine,
    MAXIMUM_LOCAL_SEGMENT_BARS,
};
use zt_protocol::{AggressorSide, Bar, DataStatus, Environment, EventHeader, Provider, TradeEvent};
use zt_storage::{SegmentKey, SegmentMetadata, SegmentStore, StorageError};

/// Public provider available to a local desktop adapter.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PublicProvider {
    /// Binance public spot streams.
    BinanceSpot,
    /// Gate public streams; decoder work remains separate and opt-in.
    GateSpot,
    /// Gate public futures streams; decoder work remains separate and opt-in.
    GateFutures,
}

/// Explicit local connection state, never inferred from missing traffic.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LocalStreamState {
    /// No local provider connection was requested.
    Disconnected,
    /// A connection attempt is in progress.
    Connecting,
    /// The selected provider has acknowledged a public subscription.
    Connected,
    /// A sequence discontinuity requires a local recovery path.
    Gap,
    /// The selected provider is unavailable to the local client.
    Unavailable,
}

/// Public subscription configuration with integer scaling chosen from verified
/// instrument metadata before the connection is opened.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicTradeSubscription {
    /// Provider selected by the user; this is never auto-substituted.
    pub provider: PublicProvider,
    /// Normalized local symbol dictionary identifier.
    pub symbol_id: u32,
    /// Provider symbol, such as `btcusdt` for Binance spot.
    pub provider_symbol: &'static str,
    /// Decimal scale for price conversion; must be a positive power of ten.
    pub price_scale: i64,
    /// Decimal scale for quantity conversion; must be a positive power of ten.
    pub quantity_scale: i64,
    /// Locally assigned stream identifier.
    pub stream_id: u32,
}

/// Adapter output that preserves provenance and makes discontinuities visible.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdapterEvent {
    /// One verified, normalized observed trade.
    Trade(TradeEvent),
    /// A provider sequence discontinuity was observed; do not fill it locally.
    Gap {
        /// The next aggregate-trade identifier required for continuity.
        expected: u64,
        /// The provider identifier actually observed after the discontinuity.
        observed: u64,
    },
    /// A malformed or nonconforming provider payload was withheld.
    Rejected,
}

/// Decoder failure. Callers must surface this as a degraded stream, not invent a trade.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdapterError {
    /// The selected provider is not implemented by this decoder.
    UnsupportedProvider,
    /// The JSON envelope was malformed or did not match the selected stream.
    InvalidFrame,
    /// A decimal value cannot be represented exactly at the declared scale.
    NonRepresentableDecimal,
    /// A configured scale is not a positive power of ten.
    InvalidScale,
}

/// Stateful local decoder for Binance public aggregate-trade messages.
#[derive(Clone, Debug)]
pub struct BinanceAggregateTradeAdapter {
    subscription: PublicTradeSubscription,
    last_aggregate_id: Option<u64>,
}

impl BinanceAggregateTradeAdapter {
    /// Creates a credential-free public adapter. No connection is opened here.
    pub fn new(subscription: PublicTradeSubscription) -> Result<Self, AdapterError> {
        if subscription.provider != PublicProvider::BinanceSpot {
            return Err(AdapterError::UnsupportedProvider);
        }
        if decimal_places(subscription.price_scale).is_none()
            || decimal_places(subscription.quantity_scale).is_none()
        {
            return Err(AdapterError::InvalidScale);
        }
        Ok(Self {
            subscription,
            last_aggregate_id: None,
        })
    }

    /// Decodes one received Binance aggregate-trade JSON frame.
    ///
    /// The adapter accepts only the configured symbol, converts provider decimals
    /// exactly into integer protocol units, and reports a gap instead of
    /// pretending continuity when aggregate IDs skip.
    pub fn decode(&mut self, frame: &[u8]) -> Result<AdapterEvent, AdapterError> {
        let payload: BinanceAggregateTrade =
            serde_json::from_slice(frame).map_err(|_| AdapterError::InvalidFrame)?;
        if payload.event_type != "aggTrade"
            || !payload
                .symbol
                .eq_ignore_ascii_case(self.subscription.provider_symbol)
        {
            return Err(AdapterError::InvalidFrame);
        }
        let price_ticks = decimal_to_units(&payload.price, self.subscription.price_scale)?;
        let quantity_units = decimal_to_units(&payload.quantity, self.subscription.quantity_scale)?;
        if price_ticks <= 0 || quantity_units <= 0 {
            return Err(AdapterError::InvalidFrame);
        }
        if let Some(previous) = self.last_aggregate_id {
            let expected = previous.saturating_add(1);
            if payload.aggregate_trade_id != expected {
                self.last_aggregate_id = Some(payload.aggregate_trade_id);
                return Ok(AdapterEvent::Gap {
                    expected,
                    observed: payload.aggregate_trade_id,
                });
            }
        }
        self.last_aggregate_id = Some(payload.aggregate_trade_id);
        let side = if payload.buyer_is_maker {
            AggressorSide::Sell
        } else {
            AggressorSide::Buy
        };
        Ok(AdapterEvent::Trade(TradeEvent {
            header: EventHeader::new(
                self.subscription.stream_id,
                payload.aggregate_trade_id,
                payload.event_time_ms.saturating_mul(1_000_000),
                Provider::Binance,
                Environment::Live,
                DataStatus::Live,
            ),
            symbol_id: self.subscription.symbol_id,
            timestamp_ns: payload.trade_time_ms.saturating_mul(1_000_000),
            price_ticks,
            quantity: quantity_units,
            aggressor_side: side,
        }))
    }
}

#[derive(Deserialize)]
struct BinanceAggregateTrade {
    #[serde(rename = "e")]
    event_type: String,
    #[serde(rename = "E")]
    event_time_ms: u64,
    #[serde(rename = "s")]
    symbol: String,
    #[serde(rename = "a")]
    aggregate_trade_id: u64,
    #[serde(rename = "p")]
    price: String,
    #[serde(rename = "q")]
    quantity: String,
    #[serde(rename = "T")]
    trade_time_ms: u64,
    #[serde(rename = "m")]
    buyer_is_maker: bool,
}

fn decimal_places(scale: i64) -> Option<usize> {
    if scale <= 0 {
        return None;
    }
    let mut value = scale;
    let mut places = 0;
    while value > 1 {
        if value % 10 != 0 {
            return None;
        }
        value /= 10;
        places += 1;
    }
    Some(places)
}

fn decimal_to_units(value: &str, scale: i64) -> Result<i64, AdapterError> {
    let places = decimal_places(scale).ok_or(AdapterError::InvalidScale)?;
    let (whole, fractional) = value.split_once('.').unwrap_or((value, ""));
    if whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fractional.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(AdapterError::InvalidFrame);
    }
    let negative = whole.starts_with('-');
    if negative {
        return Err(AdapterError::InvalidFrame);
    }
    let whole_value = whole
        .parse::<i64>()
        .map_err(|_| AdapterError::NonRepresentableDecimal)?;
    let retained = &fractional[..fractional.len().min(places)];
    if fractional[retained.len()..]
        .bytes()
        .any(|byte| byte != b'0')
    {
        return Err(AdapterError::NonRepresentableDecimal);
    }
    let fraction_value = if retained.is_empty() {
        0
    } else {
        retained
            .parse::<i64>()
            .map_err(|_| AdapterError::NonRepresentableDecimal)?
    };
    let padding = places.saturating_sub(retained.len());
    let padded_fraction = fraction_value
        .checked_mul(
            10_i64.pow(u32::try_from(padding).map_err(|_| AdapterError::NonRepresentableDecimal)?),
        )
        .ok_or(AdapterError::NonRepresentableDecimal)?;
    whole_value
        .checked_mul(scale)
        .and_then(|value| value.checked_add(padded_fraction))
        .ok_or(AdapterError::NonRepresentableDecimal)
}

/// Explicit result from one deterministic local provider-persistence step.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LocalPersistenceEvent {
    /// No complete bar exists yet; the active observed bar stays in memory only.
    Collecting {
        /// Number of complete verified bars retained for an explicit flush.
        completed_bars: usize,
    },
    /// A complete local bar was retained; the caller should explicitly flush
    /// before providing another completed bar to this bounded session.
    ReadyToFlush {
        /// Number of complete verified bars retained for an explicit flush.
        completed_bars: usize,
    },
    /// A duplicate normalized event did not change local persistence state.
    Duplicate,
    /// Input was rejected or a discontinuity/degraded bar invalidated the batch.
    Withheld {
        /// Truthful reason no local segment can be emitted from the batch.
        reason: LocalPersistenceWithheldReason,
    },
}

/// Reason a local persistence batch is not eligible for a healthy immutable segment.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LocalPersistenceWithheldReason {
    /// The adapter reported a provider aggregate-ID gap.
    ProviderGap,
    /// The local engine detected a sequence discontinuity.
    EngineGap,
    /// A raw provider payload or normalized event was rejected.
    RejectedInput,
    /// The session received a symbol other than the one it was explicitly configured for.
    WrongSymbol,
    /// A completed bar had stale, gapped, or unavailable provenance.
    DegradedBar,
    /// A completed bar was not exactly contiguous with the buffered batch.
    NonContiguousBar,
    /// A late input would mutate history and was withheld by the local engine.
    OutOfOrder,
    /// The caller attempted to add another completed bar after the explicit batch bound was reached.
    BatchLimitReached,
}

/// Error while explicitly flushing a local verified-bar batch.
#[derive(Debug)]
pub enum LocalPersistenceError {
    /// No complete bars were retained for an explicit write.
    EmptyBatch,
    /// A degraded batch must be discarded and recreated after an explicit recovery boundary.
    DegradedBatch,
    /// Existing immutable history has the same segment identity and was preserved.
    ExistingSegment(SegmentKey),
    /// The bounded local segment codec rejected the completed bars.
    Encode(&'static str),
    /// A local filesystem operation failed.
    Storage(StorageError),
}

/// Explicit bounded state machine that writes only completed observed bars to a
/// local immutable segment. Constructing or using it never opens a provider connection.
#[derive(Clone, Debug)]
pub struct LocalProviderPersistenceSession {
    symbol_id: u32,
    interval_ns: u64,
    maximum_bars: usize,
    engine: LocalDataEngine,
    completed_bars: Vec<Bar>,
    degraded: bool,
}

impl LocalProviderPersistenceSession {
    /// Creates a local session for exactly one normalized symbol and interval.
    pub fn new(
        symbol_id: u32,
        interval_ns: u64,
        maximum_bars: usize,
    ) -> Result<Self, &'static str> {
        if interval_ns == 0 || maximum_bars == 0 || maximum_bars > MAXIMUM_LOCAL_SEGMENT_BARS {
            return Err("local provider persistence bounds are invalid");
        }
        Ok(Self {
            symbol_id,
            interval_ns,
            maximum_bars,
            engine: LocalDataEngine::new(interval_ns),
            completed_bars: Vec::with_capacity(maximum_bars),
            degraded: false,
        })
    }

    /// Applies one adapter outcome without contacting a provider or storage backend.
    pub fn ingest_adapter_event(&mut self, event: AdapterEvent) -> LocalPersistenceEvent {
        match event {
            AdapterEvent::Gap { .. } => self.withhold(LocalPersistenceWithheldReason::ProviderGap),
            AdapterEvent::Rejected => self.withhold(LocalPersistenceWithheldReason::RejectedInput),
            AdapterEvent::Trade(trade) => {
                if trade.symbol_id != self.symbol_id {
                    return self.withhold(LocalPersistenceWithheldReason::WrongSymbol);
                }
                match self.engine.ingest_trade(&trade) {
                    EngineEvent::UpdatedActiveBar => self.collecting(),
                    EngineEvent::Duplicate => LocalPersistenceEvent::Duplicate,
                    EngineEvent::GapDetected { .. } => {
                        self.withhold(LocalPersistenceWithheldReason::EngineGap)
                    }
                    EngineEvent::Rejected(_) => {
                        self.withhold(LocalPersistenceWithheldReason::RejectedInput)
                    }
                    EngineEvent::OutOfOrder => {
                        self.withhold(LocalPersistenceWithheldReason::OutOfOrder)
                    }
                    EngineEvent::Completed(CompletedBar(bar)) => self.retain_completed_bar(bar),
                }
            }
        }
    }

    /// Writes the retained completed bars as one immutable segment only on an explicit caller request.
    pub fn flush(
        &mut self,
        store: &SegmentStore,
        captured_at_ns: u64,
        access_time: u64,
    ) -> Result<SegmentMetadata, LocalPersistenceError> {
        if self.degraded {
            return Err(LocalPersistenceError::DegradedBatch);
        }
        let Some(first) = self.completed_bars.first().copied() else {
            return Err(LocalPersistenceError::EmptyBatch);
        };
        let key = SegmentKey {
            symbol_id: self.symbol_id,
            interval_ns: self.interval_ns,
            start_ns: first.open_time_ns,
        };
        let payload = encode_local_bar_segment(key, captured_at_ns, &self.completed_bars).map_err(
            |error| match error {
                zt_core::LocalSceneError::InvalidSegment(reason) => {
                    LocalPersistenceError::Encode(reason)
                }
                zt_core::LocalSceneError::InvalidRequest | zt_core::LocalSceneError::Storage(_) => {
                    LocalPersistenceError::Encode("local bar segment could not be encoded")
                }
            },
        )?;
        match store.write(key, &payload, access_time, DataStatus::Live) {
            Ok(metadata) => {
                self.completed_bars.clear();
                Ok(metadata)
            }
            Err(StorageError::SegmentAlreadyExists(existing)) => {
                Err(LocalPersistenceError::ExistingSegment(existing))
            }
            Err(error) => Err(LocalPersistenceError::Storage(error)),
        }
    }

    /// Returns the provisional active observed bar; it is never persisted by `flush`.
    #[must_use]
    pub fn active_bar(&self) -> Option<Bar> {
        self.engine.active_bar()
    }

    /// Returns the number of complete bars currently retained only in this process.
    #[must_use]
    pub fn completed_bar_count(&self) -> usize {
        self.completed_bars.len()
    }

    fn collecting(&self) -> LocalPersistenceEvent {
        if self.degraded {
            LocalPersistenceEvent::Withheld {
                reason: LocalPersistenceWithheldReason::EngineGap,
            }
        } else {
            LocalPersistenceEvent::Collecting {
                completed_bars: self.completed_bars.len(),
            }
        }
    }

    fn retain_completed_bar(&mut self, bar: Bar) -> LocalPersistenceEvent {
        if self.degraded {
            return LocalPersistenceEvent::Withheld {
                reason: LocalPersistenceWithheldReason::EngineGap,
            };
        }
        if self.completed_bars.len() >= self.maximum_bars {
            return self.withhold(LocalPersistenceWithheldReason::BatchLimitReached);
        }
        if bar.symbol_id != self.symbol_id || bar.interval_ns != self.interval_ns {
            return self.withhold(LocalPersistenceWithheldReason::WrongSymbol);
        }
        if bar.data_status != DataStatus::Live {
            return self.withhold(LocalPersistenceWithheldReason::DegradedBar);
        }
        if let Some(prior) = self.completed_bars.last() {
            if bar.open_time_ns != prior.open_time_ns.saturating_add(self.interval_ns) {
                return self.withhold(LocalPersistenceWithheldReason::NonContiguousBar);
            }
        }
        self.completed_bars.push(bar);
        if self.completed_bars.len() == self.maximum_bars {
            LocalPersistenceEvent::ReadyToFlush {
                completed_bars: self.completed_bars.len(),
            }
        } else {
            LocalPersistenceEvent::Collecting {
                completed_bars: self.completed_bars.len(),
            }
        }
    }

    fn withhold(&mut self, reason: LocalPersistenceWithheldReason) -> LocalPersistenceEvent {
        self.completed_bars.clear();
        self.degraded = true;
        LocalPersistenceEvent::Withheld { reason }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use zt_core::{prepare_local_chart_scene, LocalChartScene, LocalSceneRequest};

    fn subscription() -> PublicTradeSubscription {
        PublicTradeSubscription {
            provider: PublicProvider::BinanceSpot,
            symbol_id: 1,
            provider_symbol: "btcusdt",
            price_scale: 100,
            quantity_scale: 1_000,
            stream_id: 42,
        }
    }

    #[test]
    fn normalizes_a_provider_shaped_binance_trade_without_network_access() {
        let mut adapter =
            BinanceAggregateTradeAdapter::new(subscription()).expect("adapter should configure");
        let event = adapter.decode(br#"{"e":"aggTrade","E":1000,"s":"BTCUSDT","a":7,"p":"123.45","q":"0.125","T":999,"m":true}"#).expect("frame should decode");
        assert_eq!(
            event,
            AdapterEvent::Trade(TradeEvent {
                header: EventHeader::new(
                    42,
                    7,
                    1_000_000_000,
                    Provider::Binance,
                    Environment::Live,
                    DataStatus::Live
                ),
                symbol_id: 1,
                timestamp_ns: 999_000_000,
                price_ticks: 12_345,
                quantity: 125,
                aggressor_side: AggressorSide::Sell,
            })
        );
    }

    #[test]
    fn reports_gap_instead_of_inventing_continuity() {
        let mut adapter =
            BinanceAggregateTradeAdapter::new(subscription()).expect("adapter should configure");
        let first =
            br#"{"e":"aggTrade","E":1,"s":"BTCUSDT","a":7,"p":"1","q":"1","T":1,"m":false}"#;
        let skipped =
            br#"{"e":"aggTrade","E":2,"s":"BTCUSDT","a":9,"p":"1","q":"1","T":2,"m":false}"#;
        assert!(matches!(adapter.decode(first), Ok(AdapterEvent::Trade(_))));
        assert_eq!(
            adapter.decode(skipped),
            Ok(AdapterEvent::Gap {
                expected: 8,
                observed: 9
            })
        );
    }

    #[test]
    fn rejects_extra_precision_and_wrong_symbols() {
        let mut adapter =
            BinanceAggregateTradeAdapter::new(subscription()).expect("adapter should configure");
        assert_eq!(adapter.decode(br#"{"e":"aggTrade","E":1,"s":"BTCUSDT","a":1,"p":"1.001","q":"1","T":1,"m":false}"#), Err(AdapterError::NonRepresentableDecimal));
        assert_eq!(
            adapter.decode(
                br#"{"e":"aggTrade","E":1,"s":"ETHUSDT","a":1,"p":"1","q":"1","T":1,"m":false}"#
            ),
            Err(AdapterError::InvalidFrame)
        );
    }

    fn temporary_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("zt-adapter-persistence-{label}-{nonce}"))
    }

    fn observed_trade(sequence: u64, timestamp_ns: u64, symbol_id: u32) -> AdapterEvent {
        AdapterEvent::Trade(TradeEvent {
            header: EventHeader::new(
                7,
                sequence,
                timestamp_ns,
                Provider::Binance,
                Environment::Live,
                DataStatus::Live,
            ),
            symbol_id,
            timestamp_ns,
            price_ticks: 100 + i64::try_from(sequence).expect("small deterministic sequence"),
            quantity: 1,
            aggressor_side: AggressorSide::Buy,
        })
    }

    fn collect_two_completed_bars(session: &mut LocalProviderPersistenceSession) {
        assert_eq!(
            session.ingest_adapter_event(observed_trade(1, 1, 1)),
            LocalPersistenceEvent::Collecting { completed_bars: 0 }
        );
        assert_eq!(
            session.ingest_adapter_event(observed_trade(2, 101, 1)),
            LocalPersistenceEvent::Collecting { completed_bars: 1 }
        );
        assert_eq!(
            session.ingest_adapter_event(observed_trade(3, 201, 1)),
            LocalPersistenceEvent::Collecting { completed_bars: 2 }
        );
    }

    #[test]
    fn persists_only_completed_contiguous_live_bars_into_an_immutable_local_segment() {
        let root = temporary_root("completed-live");
        let store = SegmentStore::open(&root).expect("local store should open");
        let mut session = LocalProviderPersistenceSession::new(1, 100, 10)
            .expect("bounded local session should configure");
        collect_two_completed_bars(&mut session);
        assert_eq!(
            session
                .active_bar()
                .expect("active observed bar")
                .open_time_ns,
            200
        );
        let metadata = session
            .flush(&store, 300, 9)
            .expect("explicit local flush should persist");
        assert_eq!(
            metadata.key,
            SegmentKey {
                symbol_id: 1,
                interval_ns: 100,
                start_ns: 0
            }
        );
        assert_eq!(metadata.data_status, DataStatus::Live);
        assert_eq!(session.completed_bar_count(), 0);

        let scene = prepare_local_chart_scene(
            &store,
            metadata.key,
            LocalSceneRequest::new(0, 2).expect("two candle scene request"),
            300,
            1,
        )
        .expect("integrity-checked persisted bars should prepare a local scene");
        let LocalChartScene::Renderable(scene) = scene else {
            panic!("fresh completed local bars should be renderable")
        };
        assert_eq!(scene.candles.len(), 2);
        assert_eq!(scene.candles[0].open_time_ns, 0);
        assert_eq!(scene.candles[1].open_time_ns, 100);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn gaps_and_rejected_symbols_clear_the_batch_and_refuse_flush() {
        let root = temporary_root("gap");
        let store = SegmentStore::open(&root).expect("local store should open");
        let mut session = LocalProviderPersistenceSession::new(1, 100, 10)
            .expect("bounded local session should configure");
        collect_two_completed_bars(&mut session);
        assert_eq!(
            session.ingest_adapter_event(AdapterEvent::Gap {
                expected: 4,
                observed: 6,
            }),
            LocalPersistenceEvent::Withheld {
                reason: LocalPersistenceWithheldReason::ProviderGap,
            }
        );
        assert_eq!(session.completed_bar_count(), 0);
        assert!(matches!(
            session.flush(&store, 300, 9),
            Err(LocalPersistenceError::DegradedBatch)
        ));

        let mut wrong_symbol = LocalProviderPersistenceSession::new(1, 100, 10)
            .expect("bounded local session should configure");
        assert_eq!(
            wrong_symbol.ingest_adapter_event(observed_trade(1, 1, 2)),
            LocalPersistenceEvent::Withheld {
                reason: LocalPersistenceWithheldReason::WrongSymbol,
            }
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restart_conflict_preserves_existing_immutable_segment_and_bounds_are_explicit() {
        assert!(LocalProviderPersistenceSession::new(1, 0, 1).is_err());
        assert!(LocalProviderPersistenceSession::new(1, 100, 0).is_err());
        assert!(
            LocalProviderPersistenceSession::new(1, 100, MAXIMUM_LOCAL_SEGMENT_BARS + 1).is_err()
        );

        let root = temporary_root("restart-conflict");
        let store = SegmentStore::open(&root).expect("local store should open");
        let mut first = LocalProviderPersistenceSession::new(1, 100, 10)
            .expect("first session should configure");
        collect_two_completed_bars(&mut first);
        let metadata = first
            .flush(&store, 300, 9)
            .expect("first explicit write should persist");
        let (_, original_payload) = store
            .read(metadata.key)
            .expect("first segment should remain readable");

        let mut restarted = LocalProviderPersistenceSession::new(1, 100, 10)
            .expect("restarted session should configure");
        collect_two_completed_bars(&mut restarted);
        assert!(matches!(
            restarted.flush(&store, 301, 10),
            Err(LocalPersistenceError::ExistingSegment(key)) if key == metadata.key
        ));
        let (_, retained_payload) = store
            .read(metadata.key)
            .expect("conflict must not overwrite prior history");
        assert_eq!(retained_payload, original_payload);
        let _ = fs::remove_dir_all(root);
    }
}

#[cfg(feature = "live-public")]
/// Opt-in direct public WebSocket probes for native development.
///
/// These routines never accept API keys, never subscribe to private channels,
/// and never use a ZTerminal server as a proxy. Production connection lifecycle
/// management and entitlement checks remain a later native-host concern.
pub mod live_public {
    use futures_util::StreamExt;
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::Message;

    use super::{
        AdapterError, AdapterEvent, BinanceAggregateTradeAdapter, LocalPersistenceError,
        LocalPersistenceEvent, LocalProviderPersistenceSession, PublicProvider,
        PublicTradeSubscription,
    };
    use zt_storage::{SegmentMetadata, SegmentStore};

    /// Transport-level failure for a bounded local public probe.
    #[derive(Debug)]
    pub enum ProbeError {
        /// The subscription is not a supported direct public Binance spot stream.
        UnsupportedProvider,
        /// The public WebSocket handshake or stream failed. The text is
        /// diagnostic only and must never contain a credential.
        Transport(String),
        /// A received provider frame was rejected by the strict normalizer.
        Adapter(AdapterError),
        /// The provider stream ended before the requested bounded sample arrived.
        EndedEarly,
    }

    /// Reads at most `maximum_events` normalized events from Binance's public
    /// aggregate-trade WebSocket endpoint, directly from the local device.
    ///
    /// This is deliberately a bounded probe: it does not perform automatic
    /// reconnect, provider fallback, persistence, account access, or execution.
    pub async fn collect_binance_aggregate_trade_probe(
        subscription: PublicTradeSubscription,
        maximum_events: usize,
    ) -> Result<Vec<AdapterEvent>, ProbeError> {
        if subscription.provider != PublicProvider::BinanceSpot || maximum_events == 0 {
            return Err(ProbeError::UnsupportedProvider);
        }
        // Rustls requires an explicit process-level crypto provider when more
        // than one compatible implementation is present in the dependency graph.
        let _ = rustls::crypto::ring::default_provider().install_default();
        let endpoint = format!(
            "wss://stream.binance.com:9443/ws/{}@aggTrade",
            subscription.provider_symbol.to_ascii_lowercase()
        );
        let (connection, _) = connect_async(endpoint)
            .await
            .map_err(|error| ProbeError::Transport(error.to_string()))?;
        let (_, mut read) = connection.split();
        let mut adapter =
            BinanceAggregateTradeAdapter::new(subscription).map_err(ProbeError::Adapter)?;
        let mut events = Vec::with_capacity(maximum_events);
        while let Some(frame) = read.next().await {
            match frame.map_err(|error| ProbeError::Transport(error.to_string()))? {
                Message::Text(text) => {
                    let event = adapter
                        .decode(text.as_bytes())
                        .map_err(ProbeError::Adapter)?;
                    events.push(event);
                    if events.len() == maximum_events {
                        return Ok(events);
                    }
                }
                Message::Close(_) => return Err(ProbeError::EndedEarly),
                _ => {}
            }
        }
        Err(ProbeError::EndedEarly)
    }

    /// Maximum provider events a finite foreground ingestion request may read.
    pub const MAXIMUM_PUBLIC_INGESTION_EVENTS: usize = 10_000;

    /// Explicit configuration for one finite public ingestion action.
    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub struct BoundedLocalIngestionRequest {
        /// User-selected credential-free public subscription.
        pub subscription: PublicTradeSubscription,
        /// Fixed local bar interval used only for observed trade aggregation.
        pub interval_ns: u64,
        /// Maximum complete bars retained before an explicit flush is required.
        pub maximum_bars: usize,
        /// Maximum received adapter events before the direct connection exits.
        pub maximum_events: usize,
        /// Captured-at time recorded in an optional immutable local segment.
        pub captured_at_ns: u64,
        /// Caller-defined local access time stored in segment metadata.
        pub access_time: u64,
        /// Whether this finite action may perform one final explicit local flush.
        pub flush_at_end: bool,
    }

    /// Terminal storage outcome for one bounded public ingestion action.
    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum LocalIngestionFlushOutcome {
        /// The caller did not permit an automatic final local write.
        NotRequested,
        /// A healthy non-empty batch became one immutable local segment.
        Persisted(SegmentMetadata),
        /// No complete bars arrived before the finite action ended.
        Empty,
        /// A gap or degraded input made the in-memory batch ineligible for persistence.
        Withheld,
        /// An existing immutable local segment key was preserved.
        ExistingSegment,
    }

    /// Summary of one finite opt-in direct public ingestion action.
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct BoundedLocalIngestionResult {
        /// Number of provider adapter events observed before the explicit stop.
        pub observed_events: usize,
        /// Persistence transitions corresponding to each observed adapter event.
        pub persistence_events: Vec<LocalPersistenceEvent>,
        /// Explicit final local storage outcome.
        pub flush_outcome: LocalIngestionFlushOutcome,
    }

    /// Error that prevents completion of a finite local ingestion action.
    #[derive(Debug)]
    pub enum LocalIngestionError {
        /// Request bounds are invalid before any connection attempt.
        InvalidBounds,
        /// The direct selected-provider probe failed without fallback or retry.
        Probe(ProbeError),
        /// A local filesystem write failed; prior immutable data remains unchanged.
        Storage(LocalPersistenceError),
    }

    /// Performs one finite, opt-in public Binance sample and optionally flushes a
    /// healthy local completed-bar batch. This routine never reconnects, starts a
    /// background task, chooses a fallback provider, or performs broker actions.
    pub async fn ingest_binance_aggregate_trade_probe_locally(
        request: BoundedLocalIngestionRequest,
        store: &SegmentStore,
    ) -> Result<BoundedLocalIngestionResult, LocalIngestionError> {
        validate_ingestion_request(request)?;
        let adapter_events =
            collect_binance_aggregate_trade_probe(request.subscription, request.maximum_events)
                .await
                .map_err(LocalIngestionError::Probe)?;
        finish_adapter_events(request, store, adapter_events)
    }

    fn validate_ingestion_request(
        request: BoundedLocalIngestionRequest,
    ) -> Result<(), LocalIngestionError> {
        if request.maximum_events == 0
            || request.maximum_events > MAXIMUM_PUBLIC_INGESTION_EVENTS
            || request.interval_ns == 0
            || request.maximum_bars == 0
            || request.maximum_bars > zt_core::MAXIMUM_LOCAL_SEGMENT_BARS
        {
            return Err(LocalIngestionError::InvalidBounds);
        }
        Ok(())
    }

    fn finish_adapter_events(
        request: BoundedLocalIngestionRequest,
        store: &SegmentStore,
        adapter_events: Vec<AdapterEvent>,
    ) -> Result<BoundedLocalIngestionResult, LocalIngestionError> {
        validate_ingestion_request(request)?;
        if adapter_events.len() > request.maximum_events {
            return Err(LocalIngestionError::InvalidBounds);
        }
        let mut session = LocalProviderPersistenceSession::new(
            request.subscription.symbol_id,
            request.interval_ns,
            request.maximum_bars,
        )
        .map_err(|_| LocalIngestionError::InvalidBounds)?;
        let persistence_events: Vec<_> = adapter_events
            .into_iter()
            .map(|event| session.ingest_adapter_event(event))
            .collect();
        let flush_outcome = if !request.flush_at_end {
            LocalIngestionFlushOutcome::NotRequested
        } else {
            match session.flush(store, request.captured_at_ns, request.access_time) {
                Ok(metadata) => LocalIngestionFlushOutcome::Persisted(metadata),
                Err(LocalPersistenceError::EmptyBatch) => LocalIngestionFlushOutcome::Empty,
                Err(LocalPersistenceError::DegradedBatch) => LocalIngestionFlushOutcome::Withheld,
                Err(LocalPersistenceError::ExistingSegment(_)) => {
                    LocalIngestionFlushOutcome::ExistingSegment
                }
                Err(error @ LocalPersistenceError::Encode(_))
                | Err(error @ LocalPersistenceError::Storage(_)) => {
                    return Err(LocalIngestionError::Storage(error));
                }
            }
        };
        Ok(BoundedLocalIngestionResult {
            observed_events: persistence_events.len(),
            persistence_events,
            flush_outcome,
        })
    }

    #[cfg(test)]
    mod tests {
        use std::fs;
        use std::path::PathBuf;
        use std::time::{SystemTime, UNIX_EPOCH};

        use super::*;
        use zt_protocol::{
            AggressorSide, DataStatus, Environment, EventHeader, Provider, TradeEvent,
        };

        fn temporary_root(label: &str) -> PathBuf {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after epoch")
                .as_nanos();
            std::env::temp_dir().join(format!("zt-public-ingestion-{label}-{nonce}"))
        }

        fn subscription() -> PublicTradeSubscription {
            PublicTradeSubscription {
                provider: PublicProvider::BinanceSpot,
                symbol_id: 1,
                provider_symbol: "btcusdt",
                price_scale: 100,
                quantity_scale: 1_000,
                stream_id: 7,
            }
        }

        fn request(flush_at_end: bool) -> BoundedLocalIngestionRequest {
            BoundedLocalIngestionRequest {
                subscription: subscription(),
                interval_ns: 100,
                maximum_bars: 10,
                maximum_events: 3,
                captured_at_ns: 300,
                access_time: 9,
                flush_at_end,
            }
        }

        fn observed_trade(sequence: u64, timestamp_ns: u64) -> AdapterEvent {
            AdapterEvent::Trade(TradeEvent {
                header: EventHeader::new(
                    7,
                    sequence,
                    timestamp_ns,
                    Provider::Binance,
                    Environment::Live,
                    DataStatus::Live,
                ),
                symbol_id: 1,
                timestamp_ns,
                price_ticks: 100 + i64::try_from(sequence).expect("small deterministic sequence"),
                quantity: 1,
                aggressor_side: AggressorSide::Buy,
            })
        }

        #[test]
        fn finite_supplied_events_stop_without_flush_when_not_explicitly_requested() {
            let root = temporary_root("no-flush");
            let store = SegmentStore::open(&root).expect("local store should open");
            let result = finish_adapter_events(
                request(false),
                &store,
                vec![
                    observed_trade(1, 1),
                    observed_trade(2, 101),
                    observed_trade(3, 201),
                ],
            )
            .expect("finite local event sequence should complete");
            assert_eq!(result.observed_events, 3);
            assert_eq!(
                result.flush_outcome,
                LocalIngestionFlushOutcome::NotRequested
            );
            let _ = fs::remove_dir_all(root);
        }

        #[test]
        fn supplied_gap_withholds_final_flush_without_provider_fallback() {
            let root = temporary_root("gap");
            let store = SegmentStore::open(&root).expect("local store should open");
            let result = finish_adapter_events(
                request(true),
                &store,
                vec![
                    observed_trade(1, 1),
                    AdapterEvent::Gap {
                        expected: 2,
                        observed: 4,
                    },
                ],
            )
            .expect("gap should complete as a withheld local outcome");
            assert_eq!(result.observed_events, 2);
            assert_eq!(result.flush_outcome, LocalIngestionFlushOutcome::Withheld);
            assert!(matches!(
                result.persistence_events.last(),
                Some(LocalPersistenceEvent::Withheld { .. })
            ));
            let _ = fs::remove_dir_all(root);
        }

        #[test]
        fn invalid_bounds_are_rejected_before_any_direct_connection_attempt() {
            let root = temporary_root("invalid-bounds");
            let store = SegmentStore::open(&root).expect("local store should open");
            let mut invalid = request(true);
            invalid.maximum_events = MAXIMUM_PUBLIC_INGESTION_EVENTS + 1;
            assert!(matches!(
                finish_adapter_events(invalid, &store, Vec::new()),
                Err(LocalIngestionError::InvalidBounds)
            ));
            let _ = fs::remove_dir_all(root);
        }
    }
}
