//! Bounded, deterministic local data-engine primitives for ZTerminal desktop.
//!
//! The crate intentionally contains no network or GUI code. It validates a
//! normalized stream, reports sequence faults, and aggregates only observed
//! events into bars. Missing intervals are never synthesized.

use std::error::Error;
use std::fmt::{Display, Formatter};

use zt_protocol::{validate_trade, Bar, DataStatus, TradeEvent, ValidationError};
use zt_storage::{local_availability, LocalAvailability, SegmentKey, SegmentStore, StorageError};

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

/// A bounded, deterministic local replay over previously verified bars.
#[derive(Clone, Debug)]
pub struct ReplaySession {
    bars: Vec<Bar>,
    cursor: usize,
    expected_open_ns: Option<u64>,
}

/// Result of one explicit local replay step.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReplayStep {
    /// One verified historical bar is available for local rendering/research.
    Bar(Bar),
    /// The replay reached a missing or degraded range and must not continue.
    Halted {
        /// The timestamp the replay expected next, when known.
        expected_open_ns: Option<u64>,
        /// The provenance state that made the range unavailable.
        data_status: DataStatus,
    },
    /// Every retained verified bar was replayed.
    Completed,
}

/// Bounded local research result for an incremental EMA calculation.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct EmaResearchResult {
    /// Number of verified bars consumed before completion or halt.
    pub processed_bars: usize,
    /// Last calculated EMA value, if at least one bar was processed.
    pub last_ema: Option<f64>,
    /// Whether the run completed without encountering a gap/degraded range.
    pub complete: bool,
    /// Status which stopped the run when `complete` is false.
    pub halted_status: Option<DataStatus>,
}

impl ReplaySession {
    /// Creates a replay session with an explicit maximum retained bar count.
    ///
    /// The caller supplies only locally verified bars. A session can detect an
    /// unrepresented interval but never creates a synthetic replacement bar.
    pub fn new(bars: Vec<Bar>, maximum_bars: usize) -> Result<Self, &'static str> {
        if maximum_bars == 0 || bars.len() > maximum_bars {
            return Err("replay retention bound was exceeded");
        }
        let mut previous: Option<Bar> = None;
        for bar in &bars {
            if bar.interval_ns == 0 {
                return Err("replay bar interval must be non-zero");
            }
            if let Some(prior) = previous {
                if prior.symbol_id != bar.symbol_id
                    || prior.interval_ns != bar.interval_ns
                    || bar.open_time_ns <= prior.open_time_ns
                {
                    return Err("replay bars must be sorted for one symbol and interval");
                }
            }
            previous = Some(*bar);
        }
        Ok(Self {
            bars,
            cursor: 0,
            expected_open_ns: None,
        })
    }

    /// Advances one bar, halting on provenance degradation or an interval gap.
    pub fn step(&mut self) -> ReplayStep {
        let Some(bar) = self.bars.get(self.cursor).copied() else {
            return ReplayStep::Completed;
        };
        if let Some(expected_open_ns) = self.expected_open_ns {
            if bar.open_time_ns != expected_open_ns {
                return ReplayStep::Halted {
                    expected_open_ns: Some(expected_open_ns),
                    data_status: DataStatus::Gap,
                };
            }
        }
        if bar.data_status != DataStatus::Live {
            return ReplayStep::Halted {
                expected_open_ns: self.expected_open_ns,
                data_status: bar.data_status,
            };
        }
        self.cursor = self.cursor.saturating_add(1);
        self.expected_open_ns = Some(bar.open_time_ns.saturating_add(bar.interval_ns));
        ReplayStep::Bar(bar)
    }

    /// Runs a bounded incremental EMA calculation over the replay data.
    pub fn run_ema(&mut self, period: u32) -> EmaResearchResult {
        let mut ema = ExponentialMovingAverage::new(period);
        let mut processed_bars: usize = 0;
        loop {
            match self.step() {
                ReplayStep::Bar(bar) => {
                    let _ = ema.update(bar.close_ticks as f64);
                    processed_bars = processed_bars.saturating_add(1);
                }
                ReplayStep::Completed => {
                    return EmaResearchResult {
                        processed_bars,
                        last_ema: ema.value,
                        complete: true,
                        halted_status: None,
                    };
                }
                ReplayStep::Halted { data_status, .. } => {
                    return EmaResearchResult {
                        processed_bars,
                        last_ema: ema.value,
                        complete: false,
                        halted_status: Some(data_status),
                    };
                }
            }
        }
    }
}

/// Maximum candles a local segment decoder accepts before rejecting its payload.
///
/// This bounds retained scene-source memory independently from the renderer's
/// smaller visible-candle budget.
pub const MAXIMUM_LOCAL_SEGMENT_BARS: usize = 100_000;
/// Maximum candles a Direct3D scene request may expose for one frame.
pub const MAXIMUM_LOCAL_SCENE_CANDLES: usize = 2_000;

const LOCAL_BAR_SEGMENT_MAGIC: [u8; 8] = *b"ZTBAR001";
const LOCAL_BAR_SEGMENT_VERSION: u16 = 1;
const LOCAL_BAR_SEGMENT_HEADER_BYTES: usize = 22;
const LOCAL_BAR_SEGMENT_BAR_BYTES: usize = 69;

/// A bounded window requested from one verified local bar segment.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LocalSceneRequest {
    /// Zero-based first retained bar in the local segment.
    pub first_bar: usize,
    /// Number of candles requested for this frame.
    pub visible_bars: usize,
}

impl LocalSceneRequest {
    /// Validates an explicit visible-candle request before local scene preparation.
    pub fn new(first_bar: usize, visible_bars: usize) -> Result<Self, LocalSceneError> {
        if visible_bars == 0 || visible_bars > MAXIMUM_LOCAL_SCENE_CANDLES {
            return Err(LocalSceneError::InvalidRequest);
        }
        Ok(Self {
            first_bar,
            visible_bars,
        })
    }
}

/// A renderable subset of verified local bars. The Direct3D host must receive
/// candles only through this type, never directly from an arbitrary segment.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RenderableLocalScene {
    /// Segment identity whose bytes were integrity-checked by `SegmentStore`.
    pub key: SegmentKey,
    /// Truthful fresh/cache state for the local snapshot.
    pub availability: LocalAvailability,
    /// Total decoded bars retained in this local segment.
    pub total_bars: usize,
    /// Source index of the first candle in `candles`.
    pub first_bar: usize,
    /// Bounded candles safe for the renderer to project into a frame.
    pub candles: Vec<Bar>,
}

/// Result of preparing one native chart scene from local storage.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LocalChartScene {
    /// Verified `Live` or within-budget `Cached` bars are available for rendering.
    Renderable(RenderableLocalScene),
    /// The source range must not be rendered as a continuous candle scene.
    Withheld {
        /// Truthful reason that no candles were exposed.
        availability: LocalAvailability,
        /// Number of decoded local bars withheld, when decoding succeeded.
        retained_bars: usize,
    },
}

/// Error while decoding or bounding an explicit local scene request.
#[derive(Debug)]
pub enum LocalSceneError {
    /// A verified local file could not be read due to an I/O failure.
    Storage(StorageError),
    /// Segment bytes were not a supported, self-consistent local bar payload.
    InvalidSegment(&'static str),
    /// The requested visible range was zero, exceeded the draw budget, or fell
    /// outside the retained source range.
    InvalidRequest,
}

impl Display for LocalSceneError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Storage(error) => write!(formatter, "local scene storage failed: {error}"),
            Self::InvalidSegment(reason) => {
                write!(formatter, "local bar segment is invalid: {reason}")
            }
            Self::InvalidRequest => write!(
                formatter,
                "local chart scene request is outside its bounded range"
            ),
        }
    }
}

impl Error for LocalSceneError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Storage(error) => Some(error),
            Self::InvalidSegment(_) | Self::InvalidRequest => None,
        }
    }
}

impl From<StorageError> for LocalSceneError {
    fn from(error: StorageError) -> Self {
        Self::Storage(error)
    }
}

/// Encodes observed bars for a single immutable `SegmentStore` key.
///
/// The payload carries its captured-at time because cache access time is not a
/// truth-preserving substitute for the time at which provider data was verified.
pub fn encode_local_bar_segment(
    key: SegmentKey,
    captured_at_ns: u64,
    bars: &[Bar],
) -> Result<Vec<u8>, LocalSceneError> {
    validate_local_segment_bars(key, bars)?;
    let count = u32::try_from(bars.len()).map_err(|_| {
        LocalSceneError::InvalidSegment("bar count exceeds the local payload format")
    })?;
    let expected_bytes = LOCAL_BAR_SEGMENT_HEADER_BYTES
        .checked_add(
            bars.len()
                .checked_mul(LOCAL_BAR_SEGMENT_BAR_BYTES)
                .ok_or(LocalSceneError::InvalidSegment("bar payload size overflow"))?,
        )
        .ok_or(LocalSceneError::InvalidSegment("bar payload size overflow"))?;
    let mut encoded = Vec::with_capacity(expected_bytes);
    encoded.extend_from_slice(&LOCAL_BAR_SEGMENT_MAGIC);
    encoded.extend_from_slice(&LOCAL_BAR_SEGMENT_VERSION.to_le_bytes());
    encoded.extend_from_slice(&captured_at_ns.to_le_bytes());
    encoded.extend_from_slice(&count.to_le_bytes());
    for bar in bars {
        encoded.extend_from_slice(&bar.symbol_id.to_le_bytes());
        encoded.extend_from_slice(&bar.open_time_ns.to_le_bytes());
        encoded.extend_from_slice(&bar.interval_ns.to_le_bytes());
        encoded.extend_from_slice(&bar.open_ticks.to_le_bytes());
        encoded.extend_from_slice(&bar.high_ticks.to_le_bytes());
        encoded.extend_from_slice(&bar.low_ticks.to_le_bytes());
        encoded.extend_from_slice(&bar.close_ticks.to_le_bytes());
        encoded.extend_from_slice(&bar.volume.to_le_bytes());
        encoded.extend_from_slice(&bar.last_sequence.to_le_bytes());
        encoded.push(data_status_code(bar.data_status));
    }
    Ok(encoded)
}

/// Reads one integrity-checked local segment and prepares at most 2,000 candles.
///
/// `Gap`, `Unavailable`, `Corrupt`, and `Stale` local ranges are returned as
/// `Withheld` rather than exposing a continuous scene to the Direct3D renderer.
/// The function has no network, Render, cloud, or provider fallback behaviour.
pub fn prepare_local_chart_scene(
    store: &SegmentStore,
    key: SegmentKey,
    request: LocalSceneRequest,
    now_ns: u64,
    freshness_budget_ns: u64,
) -> Result<LocalChartScene, LocalSceneError> {
    let (metadata, payload) = match store.read(key) {
        Ok(segment) => segment,
        Err(StorageError::SegmentMissing(_)) => {
            return Ok(LocalChartScene::Withheld {
                availability: LocalAvailability::Unavailable,
                retained_bars: 0,
            });
        }
        Err(StorageError::CorruptSegment(_) | StorageError::InvalidMetadata) => {
            return Ok(LocalChartScene::Withheld {
                availability: LocalAvailability::Corrupt,
                retained_bars: 0,
            });
        }
        Err(error) => return Err(LocalSceneError::Storage(error)),
    };
    let decoded = match decode_local_bar_segment(key, &payload) {
        Ok(segment) => segment,
        Err(LocalSceneError::InvalidSegment(_)) => {
            return Ok(LocalChartScene::Withheld {
                availability: LocalAvailability::Corrupt,
                retained_bars: 0,
            });
        }
        Err(error) => return Err(error),
    };
    let availability = local_availability(
        strongest_data_status(metadata.data_status, &decoded.bars),
        decoded.captured_at_ns,
        now_ns,
        freshness_budget_ns,
    );
    if !matches!(
        availability,
        LocalAvailability::Live | LocalAvailability::Cached { .. }
    ) {
        return Ok(LocalChartScene::Withheld {
            availability,
            retained_bars: decoded.bars.len(),
        });
    }
    let last_bar = request
        .first_bar
        .checked_add(request.visible_bars)
        .ok_or(LocalSceneError::InvalidRequest)?;
    if last_bar > decoded.bars.len() {
        return Err(LocalSceneError::InvalidRequest);
    }
    Ok(LocalChartScene::Renderable(RenderableLocalScene {
        key,
        availability,
        total_bars: decoded.bars.len(),
        first_bar: request.first_bar,
        candles: decoded.bars[request.first_bar..last_bar].to_vec(),
    }))
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct DecodedLocalBarSegment {
    captured_at_ns: u64,
    bars: Vec<Bar>,
}

fn decode_local_bar_segment(
    key: SegmentKey,
    encoded: &[u8],
) -> Result<DecodedLocalBarSegment, LocalSceneError> {
    if encoded.len() < LOCAL_BAR_SEGMENT_HEADER_BYTES {
        return Err(LocalSceneError::InvalidSegment(
            "payload is shorter than its header",
        ));
    }
    if encoded[..8] != LOCAL_BAR_SEGMENT_MAGIC {
        return Err(LocalSceneError::InvalidSegment(
            "payload magic is not recognized",
        ));
    }
    let mut cursor = 8;
    if read_u16(encoded, &mut cursor)? != LOCAL_BAR_SEGMENT_VERSION {
        return Err(LocalSceneError::InvalidSegment(
            "payload version is unsupported",
        ));
    }
    let captured_at_ns = read_u64(encoded, &mut cursor)?;
    let count = usize::try_from(read_u32(encoded, &mut cursor)?)
        .map_err(|_| LocalSceneError::InvalidSegment("bar count is not representable"))?;
    if count == 0 || count > MAXIMUM_LOCAL_SEGMENT_BARS {
        return Err(LocalSceneError::InvalidSegment(
            "bar count is outside the local bound",
        ));
    }
    let expected_bytes = LOCAL_BAR_SEGMENT_HEADER_BYTES
        .checked_add(
            count
                .checked_mul(LOCAL_BAR_SEGMENT_BAR_BYTES)
                .ok_or(LocalSceneError::InvalidSegment("bar payload size overflow"))?,
        )
        .ok_or(LocalSceneError::InvalidSegment("bar payload size overflow"))?;
    if encoded.len() != expected_bytes {
        return Err(LocalSceneError::InvalidSegment(
            "payload length does not match its bar count",
        ));
    }
    let mut bars = Vec::with_capacity(count);
    for _ in 0..count {
        let bar = Bar {
            symbol_id: read_u32(encoded, &mut cursor)?,
            open_time_ns: read_u64(encoded, &mut cursor)?,
            interval_ns: read_u64(encoded, &mut cursor)?,
            open_ticks: read_i64(encoded, &mut cursor)?,
            high_ticks: read_i64(encoded, &mut cursor)?,
            low_ticks: read_i64(encoded, &mut cursor)?,
            close_ticks: read_i64(encoded, &mut cursor)?,
            volume: read_i64(encoded, &mut cursor)?,
            last_sequence: read_u64(encoded, &mut cursor)?,
            data_status: data_status_from_code(read_byte(encoded, &mut cursor)?)?,
        };
        bars.push(bar);
    }
    validate_local_segment_bars(key, &bars)?;
    Ok(DecodedLocalBarSegment {
        captured_at_ns,
        bars,
    })
}

fn validate_local_segment_bars(key: SegmentKey, bars: &[Bar]) -> Result<(), LocalSceneError> {
    if bars.is_empty() || bars.len() > MAXIMUM_LOCAL_SEGMENT_BARS {
        return Err(LocalSceneError::InvalidSegment(
            "bar count is outside the local bound",
        ));
    }
    for (index, bar) in bars.iter().enumerate() {
        let expected_open_time = key
            .start_ns
            .checked_add(
                u64::try_from(index)
                    .map_err(|_| LocalSceneError::InvalidSegment("bar index is not representable"))?
                    .checked_mul(key.interval_ns)
                    .ok_or(LocalSceneError::InvalidSegment("bar time overflow"))?,
            )
            .ok_or(LocalSceneError::InvalidSegment("bar time overflow"))?;
        if bar.symbol_id != key.symbol_id
            || bar.interval_ns != key.interval_ns
            || bar.open_time_ns != expected_open_time
        {
            return Err(LocalSceneError::InvalidSegment(
                "bars are not contiguous for the declared segment key",
            ));
        }
        if bar.volume <= 0
            || bar.low_ticks > bar.open_ticks
            || bar.low_ticks > bar.close_ticks
            || bar.high_ticks < bar.open_ticks
            || bar.high_ticks < bar.close_ticks
            || bar.low_ticks > bar.high_ticks
        {
            return Err(LocalSceneError::InvalidSegment(
                "bar OHLCV invariants are invalid",
            ));
        }
    }
    Ok(())
}

fn strongest_data_status(segment_status: DataStatus, bars: &[Bar]) -> DataStatus {
    bars.iter().fold(segment_status, |status, bar| {
        match (status, bar.data_status) {
            (DataStatus::Gap, _) | (_, DataStatus::Gap) => DataStatus::Gap,
            (DataStatus::Unavailable, _) | (_, DataStatus::Unavailable) => DataStatus::Unavailable,
            (DataStatus::Stale, _) | (_, DataStatus::Stale) => DataStatus::Stale,
            (DataStatus::Live, DataStatus::Live) => DataStatus::Live,
        }
    })
}

fn data_status_code(status: DataStatus) -> u8 {
    match status {
        DataStatus::Live => 0,
        DataStatus::Stale => 1,
        DataStatus::Gap => 2,
        DataStatus::Unavailable => 3,
    }
}

fn data_status_from_code(code: u8) -> Result<DataStatus, LocalSceneError> {
    match code {
        0 => Ok(DataStatus::Live),
        1 => Ok(DataStatus::Stale),
        2 => Ok(DataStatus::Gap),
        3 => Ok(DataStatus::Unavailable),
        _ => Err(LocalSceneError::InvalidSegment(
            "bar status code is unsupported",
        )),
    }
}

fn read_byte(encoded: &[u8], cursor: &mut usize) -> Result<u8, LocalSceneError> {
    let Some(byte) = encoded.get(*cursor).copied() else {
        return Err(LocalSceneError::InvalidSegment(
            "payload ended unexpectedly",
        ));
    };
    *cursor = cursor.saturating_add(1);
    Ok(byte)
}

fn read_u16(encoded: &[u8], cursor: &mut usize) -> Result<u16, LocalSceneError> {
    let bytes = read_array::<2>(encoded, cursor)?;
    Ok(u16::from_le_bytes(bytes))
}

fn read_u32(encoded: &[u8], cursor: &mut usize) -> Result<u32, LocalSceneError> {
    let bytes = read_array::<4>(encoded, cursor)?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_u64(encoded: &[u8], cursor: &mut usize) -> Result<u64, LocalSceneError> {
    let bytes = read_array::<8>(encoded, cursor)?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_i64(encoded: &[u8], cursor: &mut usize) -> Result<i64, LocalSceneError> {
    let bytes = read_array::<8>(encoded, cursor)?;
    Ok(i64::from_le_bytes(bytes))
}

fn read_array<const N: usize>(
    encoded: &[u8],
    cursor: &mut usize,
) -> Result<[u8; N], LocalSceneError> {
    let end = cursor
        .checked_add(N)
        .ok_or(LocalSceneError::InvalidSegment("payload cursor overflow"))?;
    let bytes = encoded
        .get(*cursor..end)
        .ok_or(LocalSceneError::InvalidSegment(
            "payload ended unexpectedly",
        ))?;
    *cursor = end;
    bytes
        .try_into()
        .map_err(|_| LocalSceneError::InvalidSegment("payload field width is invalid"))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

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

    fn bar(open_time_ns: u64, close_ticks: i64, data_status: DataStatus) -> Bar {
        Bar {
            symbol_id: 9,
            open_time_ns,
            interval_ns: SECOND,
            open_ticks: close_ticks,
            high_ticks: close_ticks,
            low_ticks: close_ticks,
            close_ticks,
            volume: 1,
            last_sequence: 1,
            data_status,
        }
    }

    #[test]
    fn replay_runs_local_ema_only_on_contiguous_verified_history() {
        let mut replay = ReplaySession::new(
            vec![
                bar(0, 10, DataStatus::Live),
                bar(SECOND, 14, DataStatus::Live),
            ],
            10,
        )
        .expect("bounded verified replay should configure");
        assert_eq!(
            replay.run_ema(3),
            EmaResearchResult {
                processed_bars: 2,
                last_ema: Some(12.0),
                complete: true,
                halted_status: None,
            }
        );
    }

    #[test]
    fn replay_halts_on_missing_interval_without_synthetic_bar() {
        let mut replay = ReplaySession::new(
            vec![
                bar(0, 10, DataStatus::Live),
                bar(SECOND * 2, 12, DataStatus::Live),
            ],
            10,
        )
        .expect("ordered source bars should configure");
        assert_eq!(replay.step(), ReplayStep::Bar(bar(0, 10, DataStatus::Live)));
        assert_eq!(
            replay.step(),
            ReplayStep::Halted {
                expected_open_ns: Some(SECOND),
                data_status: DataStatus::Gap,
            }
        );
    }

    fn temporary_scene_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after the epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("zt-core-scene-{label}-{nonce}"))
    }

    fn scene_key() -> SegmentKey {
        SegmentKey {
            symbol_id: 9,
            interval_ns: SECOND,
            start_ns: 0,
        }
    }

    fn scene_bar(index: u64, status: DataStatus) -> Bar {
        let close_ticks = 100 + i64::try_from(index).expect("small deterministic index");
        Bar {
            symbol_id: 9,
            open_time_ns: index * SECOND,
            interval_ns: SECOND,
            open_ticks: close_ticks - 1,
            high_ticks: close_ticks + 2,
            low_ticks: close_ticks - 3,
            close_ticks,
            volume: 1,
            last_sequence: index + 1,
            data_status: status,
        }
    }

    #[test]
    fn local_scene_exposes_only_the_requested_bounded_cached_window() {
        let root = temporary_scene_root("bounded-cached");
        let store = SegmentStore::open(&root).expect("local store should open");
        let key = scene_key();
        let bars: Vec<_> = (0..3_000)
            .map(|index| scene_bar(index, DataStatus::Live))
            .collect();
        let payload = encode_local_bar_segment(key, 100, &bars).expect("segment should encode");
        store
            .write(key, &payload, 1, DataStatus::Live)
            .expect("verified local segment should write");

        let request = LocalSceneRequest::new(1_000, MAXIMUM_LOCAL_SCENE_CANDLES)
            .expect("draw-budget request should be valid");
        let scene = prepare_local_chart_scene(&store, key, request, 105, 10)
            .expect("verified local scene should prepare");
        let LocalChartScene::Renderable(scene) = scene else {
            panic!("within-budget verified local data should be renderable")
        };
        assert_eq!(scene.availability, LocalAvailability::Cached { age_ns: 5 });
        assert_eq!(scene.total_bars, 3_000);
        assert_eq!(scene.first_bar, 1_000);
        assert_eq!(scene.candles.len(), MAXIMUM_LOCAL_SCENE_CANDLES);
        assert_eq!(
            scene.candles.first().expect("first candle").open_time_ns,
            1_000 * SECOND
        );
        assert_eq!(
            scene.candles.last().expect("last candle").open_time_ns,
            2_999 * SECOND
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn local_scene_withholds_gap_and_stale_ranges_without_candles() {
        let gap_root = temporary_scene_root("gap");
        let gap_store = SegmentStore::open(&gap_root).expect("local store should open");
        let key = scene_key();
        let gap_payload = encode_local_bar_segment(key, 100, &[scene_bar(0, DataStatus::Gap)])
            .expect("gap segment still has an inspectable payload");
        gap_store
            .write(key, &gap_payload, 1, DataStatus::Live)
            .expect("gap segment should write locally");
        assert_eq!(
            prepare_local_chart_scene(
                &gap_store,
                key,
                LocalSceneRequest::new(0, 1).expect("one candle request"),
                100,
                10,
            )
            .expect("gap status should be surfaced"),
            LocalChartScene::Withheld {
                availability: LocalAvailability::Gap,
                retained_bars: 1,
            }
        );
        let _ = fs::remove_dir_all(gap_root);

        let stale_root = temporary_scene_root("stale");
        let stale_store = SegmentStore::open(&stale_root).expect("local store should open");
        let stale_payload = encode_local_bar_segment(key, 100, &[scene_bar(0, DataStatus::Live)])
            .expect("segment should encode");
        stale_store
            .write(key, &stale_payload, 1, DataStatus::Live)
            .expect("segment should write locally");
        assert_eq!(
            prepare_local_chart_scene(
                &stale_store,
                key,
                LocalSceneRequest::new(0, 1).expect("one candle request"),
                111,
                10,
            )
            .expect("stale status should be surfaced"),
            LocalChartScene::Withheld {
                availability: LocalAvailability::Stale { age_ns: 11 },
                retained_bars: 1,
            }
        );
        let _ = fs::remove_dir_all(stale_root);
    }

    #[test]
    fn local_scene_withholds_missing_and_logically_corrupt_segments() {
        let missing_root = temporary_scene_root("missing");
        let missing_store = SegmentStore::open(&missing_root).expect("local store should open");
        let key = scene_key();
        assert_eq!(
            prepare_local_chart_scene(
                &missing_store,
                key,
                LocalSceneRequest::new(0, 1).expect("one candle request"),
                100,
                10,
            )
            .expect("missing local segment should be surfaced"),
            LocalChartScene::Withheld {
                availability: LocalAvailability::Unavailable,
                retained_bars: 0,
            }
        );
        let _ = fs::remove_dir_all(missing_root);

        let corrupt_root = temporary_scene_root("logical-corruption");
        let corrupt_store = SegmentStore::open(&corrupt_root).expect("local store should open");
        corrupt_store
            .write(key, b"not a local bar segment", 1, DataStatus::Live)
            .expect("integrity-checked bytes should write");
        assert_eq!(
            prepare_local_chart_scene(
                &corrupt_store,
                key,
                LocalSceneRequest::new(0, 1).expect("one candle request"),
                100,
                10,
            )
            .expect("invalid payload should be withheld"),
            LocalChartScene::Withheld {
                availability: LocalAvailability::Corrupt,
                retained_bars: 0,
            }
        );
        let _ = fs::remove_dir_all(corrupt_root);
    }

    #[test]
    fn local_scene_refuses_noncontiguous_or_oversized_draw_requests() {
        let key = scene_key();
        assert!(matches!(
            encode_local_bar_segment(
                key,
                100,
                &[
                    scene_bar(0, DataStatus::Live),
                    scene_bar(2, DataStatus::Live)
                ],
            ),
            Err(LocalSceneError::InvalidSegment(
                "bars are not contiguous for the declared segment key"
            ))
        ));
        assert!(matches!(
            LocalSceneRequest::new(0, MAXIMUM_LOCAL_SCENE_CANDLES + 1),
            Err(LocalSceneError::InvalidRequest)
        ));
    }
}
