//! Direct, local, public-market adapter contracts.
//!
//! This crate normalizes provider-shaped frames without creating sockets,
//! storing credentials, selecting fallback providers, or exposing execution.
//! The native host owns the eventual transport and must only pass received bytes
//! into an explicitly selected adapter.

use serde::Deserialize;
use zt_protocol::{AggressorSide, DataStatus, Environment, EventHeader, Provider, TradeEvent};

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
