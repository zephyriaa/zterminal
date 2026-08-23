//! Bounded, deterministic local data-engine primitives for ZTerminal desktop.
//!
//! The crate intentionally contains no network or GUI code. It validates a
//! normalized stream, reports sequence faults, and aggregates only observed
//! events into bars. Missing intervals are never synthesized.

use zt_protocol::{validate_trade, Bar, DataStatus, TradeEvent, ValidationError};

/// Result of stateful sequence validation for one logical subscription stream.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SequenceOutcome {
    /// Event is the next expected sequence.
    Accepted,
    /// Event was already observed and must not be counted twice.
    Duplicate {
        /// Most recent accepted sequence for the stream.
        last_accepted: u64,
    },
    /// One or more events are missing. The caller must request an explicit
    /// recovery rather than pretending the derived range is continuous.
    Gap {
        /// First sequence that was expected but absent.
        expected: u64,
        /// First newly received sequence after the missing range.
        received: u64,
    },
}

/// Tracks one monotonic sequence stream without retaining event history.
#[derive(Clone, Copy, Debug, Default)]
pub struct SequenceTracker {
    last_accepted: Option<u64>,
}

impl SequenceTracker {
    /// Evaluates a sequence number. A gap advances the tracker to the received
    /// sequence so later events can still be processed, but downstream output
    /// is marked with `DataStatus::Gap` until a caller performs resynchronization.
    pub fn observe(&mut self, sequence: u64) -> SequenceOutcome {
        match self.last_accepted {
            None => {
                self.last_accepted = Some(sequence);
                SequenceOutcome::Accepted
            }
            Some(last) if sequence <= last => SequenceOutcome::Duplicate {
                last_accepted: last,
            },
            Some(last) if sequence == last.saturating_add(1) => {
                self.last_accepted = Some(sequence);
                SequenceOutcome::Accepted
            }
            Some(last) => {
                let expected = last.saturating_add(1);
                self.last_accepted = Some(sequence);
                SequenceOutcome::Gap {
                    expected,
                    received: sequence,
                }
            }
        }
    }

    /// Resets stream state after a verified snapshot/recovery boundary.
    pub fn reset(&mut self) {
        self.last_accepted = None;
    }
}

/// A completed observed bar emitted when a newer interval begins.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CompletedBar(pub Bar);

/// State transition returned for each local trade ingestion attempt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EngineEvent {
    /// A validated event updated the active bar.
    UpdatedActiveBar,
    /// A new interval closed the prior observed bar.
    Completed(CompletedBar),
    /// A repeated input was ignored without changing calculations.
    Duplicate,
    /// A stream discontinuity was detected and visible derived state is marked.
    GapDetected {
        /// First sequence that was expected but absent.
        expected: u64,
        /// First newly received sequence after the missing range.
        received: u64,
    },
    /// Invalid source input was rejected.
    Rejected(ValidationError),
    /// A late event falls before the active interval. It is retained for a
    /// future explicit repair path rather than silently mutating history.
    OutOfOrder,
}

/// Incrementally aggregates a single symbol's observed trades into fixed bars.
#[derive(Clone, Debug)]
pub struct BarAggregator {
    interval_ns: u64,
    active: Option<Bar>,
}

impl BarAggregator {
    /// Creates a bar aggregator. Zero duration is invalid because it cannot
    /// represent a meaningful time interval.
    #[must_use]
    pub fn new(interval_ns: u64) -> Self {
        assert!(interval_ns > 0, "bar interval must be non-zero");
        Self {
            interval_ns,
            active: None,
        }
    }

    /// Returns the active incomplete observed bar, if present.
    #[must_use]
    pub fn active(&self) -> Option<Bar> {
        self.active
    }

    fn interval_start(&self, timestamp_ns: u64) -> u64 {
        timestamp_ns - (timestamp_ns % self.interval_ns)
    }

    fn create_bar(&self, trade: &TradeEvent, data_status: DataStatus) -> Bar {
        Bar {
            symbol_id: trade.symbol_id,
            open_time_ns: self.interval_start(trade.timestamp_ns),
            interval_ns: self.interval_ns,
            open_ticks: trade.price_ticks,
            high_ticks: trade.price_ticks,
            low_ticks: trade.price_ticks,
            close_ticks: trade.price_ticks,
            volume: trade.quantity,
            last_sequence: trade.header.sequence,
            data_status,
        }
    }

    /// Applies a validated event. The method emits only a prior bar that was
    /// explicitly observed; it creates no zero-volume filler bars.
    pub fn ingest(&mut self, trade: &TradeEvent, force_gap_status: bool) -> EngineEvent {
        let status = if force_gap_status {
            DataStatus::Gap
        } else {
            trade.header.data_status
        };
        let start = self.interval_start(trade.timestamp_ns);
        match self.active.as_mut() {
            None => {
                self.active = Some(self.create_bar(trade, status));
                EngineEvent::UpdatedActiveBar
            }
            Some(active) if active.symbol_id != trade.symbol_id || start < active.open_time_ns => {
                EngineEvent::OutOfOrder
            }
            Some(active) if start == active.open_time_ns => {
                active.high_ticks = active.high_ticks.max(trade.price_ticks);
                active.low_ticks = active.low_ticks.min(trade.price_ticks);
                active.close_ticks = trade.price_ticks;
                active.volume = active.volume.saturating_add(trade.quantity);
                active.last_sequence = trade.header.sequence;
                if status == DataStatus::Gap {
                    active.data_status = DataStatus::Gap;
                }
                EngineEvent::UpdatedActiveBar
            }
            Some(_) => {
                let completed = self.active.expect("active bar was checked");
                self.active = Some(self.create_bar(trade, status));
                EngineEvent::Completed(CompletedBar(completed))
            }
        }
    }
}

/// A small local engine for one normalized symbol stream and bar interval.
#[derive(Clone, Debug)]
pub struct LocalDataEngine {
    sequence: SequenceTracker,
    bars: BarAggregator,
}

impl LocalDataEngine {
    /// Creates an engine that derives bars locally from observed trade events.
    #[must_use]
    pub fn new(interval_ns: u64) -> Self {
        Self {
            sequence: SequenceTracker::default(),
            bars: BarAggregator::new(interval_ns),
        }
    }

    /// Validates, sequence-checks, and aggregates one event without allocating.
    pub fn ingest_trade(&mut self, trade: &TradeEvent) -> EngineEvent {
        if let Err(error) = validate_trade(trade) {
            return EngineEvent::Rejected(error);
        }
        match self.sequence.observe(trade.header.sequence) {
            SequenceOutcome::Duplicate { .. } => EngineEvent::Duplicate,
            SequenceOutcome::Accepted => self.bars.ingest(trade, false),
            SequenceOutcome::Gap { expected, received } => {
                let _ = self.bars.ingest(trade, true);
                EngineEvent::GapDetected { expected, received }
            }
        }
    }

    /// Exposes the current incomplete bar for a truthful provisional display.
    #[must_use]
    pub fn active_bar(&self) -> Option<Bar> {
        self.bars.active()
    }

    /// Starts a new sequence epoch after a verified recovery snapshot.
    pub fn reset_after_verified_recovery(&mut self) {
        self.sequence.reset();
    }
}

/// Incremental EMA state that never rescans historical bars after initialization.
#[derive(Clone, Copy, Debug)]
pub struct ExponentialMovingAverage {
    alpha: f64,
    value: Option<f64>,
}

impl ExponentialMovingAverage {
    /// Creates a positive-period EMA.
    #[must_use]
    pub fn new(period: u32) -> Self {
        assert!(period > 0, "EMA period must be positive");
        Self {
            alpha: 2.0 / (f64::from(period) + 1.0),
            value: None,
        }
    }

    /// Updates and returns the next EMA value in constant time.
    pub fn update(&mut self, sample: f64) -> f64 {
        let next = match self.value {
            Some(previous) => previous + self.alpha * (sample - previous),
            None => sample,
        };
        self.value = Some(next);
        next
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zt_protocol::{AggressorSide, Environment, EventHeader, Provider};

    const SECOND: u64 = 1_000_000_000;

    fn trade(sequence: u64, timestamp_ns: u64, price_ticks: i64, quantity: i64) -> TradeEvent {
        TradeEvent {
            header: EventHeader::new(
                7,
                sequence,
                timestamp_ns,
                Provider::Fixture,
                Environment::Simulation,
                DataStatus::Live,
            ),
            symbol_id: 9,
            timestamp_ns,
            price_ticks,
            quantity,
            aggressor_side: AggressorSide::Unknown,
        }
    }

    #[test]
    fn aggregates_only_observed_events() {
        let mut engine = LocalDataEngine::new(SECOND);
        assert_eq!(
            engine.ingest_trade(&trade(1, 100, 10, 2)),
            EngineEvent::UpdatedActiveBar
        );
        assert_eq!(
            engine.ingest_trade(&trade(2, 500, 12, 3)),
            EngineEvent::UpdatedActiveBar
        );
        let completed = engine.ingest_trade(&trade(3, SECOND + 1, 11, 1));
        let EngineEvent::Completed(CompletedBar(bar)) = completed else {
            panic!("expected completed bar")
        };
        assert_eq!(
            (
                bar.open_ticks,
                bar.high_ticks,
                bar.low_ticks,
                bar.close_ticks,
                bar.volume
            ),
            (10, 12, 10, 12, 5)
        );
    }

    #[test]
    fn marks_gap_instead_of_manufacturing_continuity() {
        let mut engine = LocalDataEngine::new(SECOND);
        let _ = engine.ingest_trade(&trade(4, 10, 10, 1));
        assert_eq!(
            engine.ingest_trade(&trade(6, 20, 11, 1)),
            EngineEvent::GapDetected {
                expected: 5,
                received: 6
            }
        );
        assert_eq!(
            engine.active_bar().expect("active").data_status,
            DataStatus::Gap
        );
    }

    #[test]
    fn ignores_duplicate_without_recounting_volume() {
        let mut engine = LocalDataEngine::new(SECOND);
        let source = trade(1, 10, 10, 5);
        let _ = engine.ingest_trade(&source);
        assert_eq!(engine.ingest_trade(&source), EngineEvent::Duplicate);
        assert_eq!(engine.active_bar().expect("active").volume, 5);
    }

    #[test]
    fn ema_is_incremental() {
        let mut ema = ExponentialMovingAverage::new(3);
        assert_eq!(ema.update(10.0), 10.0);
        assert_eq!(ema.update(14.0), 12.0);
        assert_eq!(ema.update(14.0), 13.0);
    }
}
