//! Versioned internal contracts for ZTerminal desktop data transport.
//!
//! These types deliberately carry provider, environment, status, and sequence
//! metadata. A renderer or analytics engine must not manufacture data that was
//! absent from an upstream feed.

/// The first supported binary/control envelope version.
pub const PROTOCOL_VERSION: u16 = 1;

/// Identifies the origin that supplied a normalized event.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Provider {
    /// Binance public market data.
    Binance,
    /// Gate.io public market data.
    GateIo,
    /// A provider used only for deterministic development fixtures.
    Fixture,
}

/// Declares whether a normalized event is simulated, paper, or live.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Environment {
    /// Deterministic fixture or test data.
    Simulation,
    /// A paper-trading environment.
    Paper,
    /// A provider-labelled live environment.
    Live,
}

/// Describes whether data is currently usable for analysis.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DataStatus {
    /// The feed is verified for the event's declared provider and environment.
    Live,
    /// The latest state is older than the declared freshness budget.
    Stale,
    /// A sequence gap or malformed input makes the relevant range unavailable.
    Gap,
    /// The provider has not supplied the requested input.
    Unavailable,
}

/// Transport metadata attached to every normalized event.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EventHeader {
    /// Contract version understood by the receiver.
    pub protocol_version: u16,
    /// Logical subscription stream identifier.
    pub stream_id: u32,
    /// Strictly monotonic sequence number within a stream.
    pub sequence: u64,
    /// UTC receive time expressed as nanoseconds since Unix epoch.
    pub received_at_ns: u64,
    /// Provider provenance.
    pub provider: Provider,
    /// Declared provider environment.
    pub environment: Environment,
    /// Freshness/integrity state at normalization time.
    pub data_status: DataStatus,
}

impl EventHeader {
    /// Creates a header for an explicitly declared input event.
    pub const fn new(
        stream_id: u32,
        sequence: u64,
        received_at_ns: u64,
        provider: Provider,
        environment: Environment,
        data_status: DataStatus,
    ) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            stream_id,
            sequence,
            received_at_ns,
            provider,
            environment,
            data_status,
        }
    }
}

/// The observed aggressor classification when a provider supplies it.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AggressorSide {
    /// Buyer-initiated trade reported by the provider.
    Buy,
    /// Seller-initiated trade reported by the provider.
    Sell,
    /// The provider did not supply an inspectable classification.
    Unknown,
}

/// Compact normalized trade event using integer tick and quantity units.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TradeEvent {
    /// Envelope metadata.
    pub header: EventHeader,
    /// Dictionary-backed symbol identifier, never a repeated symbol string.
    pub symbol_id: u32,
    /// Exchange event time in UTC nanoseconds.
    pub timestamp_ns: u64,
    /// Price expressed in the contract's integer tick scale.
    pub price_ticks: i64,
    /// Positive quantity expressed in the contract's quantity scale.
    pub quantity: i64,
    /// Provider-supplied aggressor side, when available.
    pub aggressor_side: AggressorSide,
}

/// Compact normalized OHLCV bar produced from verified local inputs.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Bar {
    /// Symbol dictionary identifier.
    pub symbol_id: u32,
    /// Inclusive UTC start in nanoseconds.
    pub open_time_ns: u64,
    /// Bar duration in nanoseconds.
    pub interval_ns: u64,
    /// Open in integer ticks.
    pub open_ticks: i64,
    /// High in integer ticks.
    pub high_ticks: i64,
    /// Low in integer ticks.
    pub low_ticks: i64,
    /// Close in integer ticks.
    pub close_ticks: i64,
    /// Total positive quantity for the interval.
    pub volume: i64,
    /// The last verified sequence contributing to the bar.
    pub last_sequence: u64,
    /// Integrity state propagated from contributing input.
    pub data_status: DataStatus,
}

/// The only supported reason to discard an event from a local pipeline.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ValidationError {
    /// The sender and receiver do not support a common protocol version.
    UnsupportedProtocolVersion,
    /// Quantity is zero or negative.
    NonPositiveQuantity,
    /// Price is not representable in the declared tick unit.
    InvalidPrice,
}

/// Validates event-local invariants; sequence validation is stream stateful and
/// lives in `zt-core`.
pub fn validate_trade(event: &TradeEvent) -> Result<(), ValidationError> {
    if event.header.protocol_version != PROTOCOL_VERSION {
        return Err(ValidationError::UnsupportedProtocolVersion);
    }
    if event.quantity <= 0 {
        return Err(ValidationError::NonPositiveQuantity);
    }
    if event.price_ticks <= 0 {
        return Err(ValidationError::InvalidPrice);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn trade(quantity: i64) -> TradeEvent {
        TradeEvent {
            header: EventHeader::new(
                1,
                1,
                1,
                Provider::Fixture,
                Environment::Simulation,
                DataStatus::Live,
            ),
            symbol_id: 1,
            timestamp_ns: 1,
            price_ticks: 42,
            quantity,
            aggressor_side: AggressorSide::Unknown,
        }
    }

    #[test]
    fn rejects_non_positive_quantities() {
        assert_eq!(
            validate_trade(&trade(0)),
            Err(ValidationError::NonPositiveQuantity)
        );
    }

    #[test]
    fn accepts_declared_valid_trade() {
        assert_eq!(validate_trade(&trade(1)), Ok(()));
    }
}
