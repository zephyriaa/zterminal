use crate::{ExecutionError, Result};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExecutionMode {
    Paper,
    SpotLive,
    FuturesLive,
}

impl ExecutionMode {
    pub fn require_enabled(self) -> Result<()> {
        match self {
            Self::Paper => Ok(()),
            _ => Err(ExecutionError::LiveDisabled),
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum Side {
    Buy,
    Sell,
}

/// Engine-normalized Spot limit intent. No authentication or raw request fields.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct LimitOrder {
    pub symbol: String,
    pub side: Side,
    #[serde(with = "rust_decimal::serde::str")]
    pub quantity: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub price: Decimal,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SymbolInfo {
    pub symbol: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub price_tick: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub quantity_step: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub min_quantity: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub max_quantity: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub min_notional: Decimal,
}

pub(crate) fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

impl SymbolInfo {
    pub fn validate(&self) -> Result<()> {
        if !identifier(&self.symbol)
            || self.price_tick <= Decimal::ZERO
            || self.quantity_step <= Decimal::ZERO
            || self.min_quantity <= Decimal::ZERO
            || self.max_quantity < self.min_quantity
            || self.min_notional < Decimal::ZERO
        {
            return Err(ExecutionError::InvalidInput);
        }
        Ok(())
    }
    pub fn validate_order(&self, order: &LimitOrder) -> Result<Decimal> {
        self.validate()?;
        if order.symbol != self.symbol
            || order.price <= Decimal::ZERO
            || order.quantity < self.min_quantity
            || order.quantity > self.max_quantity
            || order
                .price
                .checked_rem(self.price_tick)
                .ok_or(ExecutionError::Arithmetic)?
                != Decimal::ZERO
            || order
                .quantity
                .checked_rem(self.quantity_step)
                .ok_or(ExecutionError::Arithmetic)?
                != Decimal::ZERO
        {
            return Err(ExecutionError::Filter);
        }
        let notional = mul(order.price, order.quantity)?;
        if notional < self.min_notional {
            return Err(ExecutionError::Filter);
        }
        Ok(notional)
    }
}

/// A received quote with explicitly modeled finite fill capacity, not an order book.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Quote {
    pub symbol: String,
    pub sequence: u64,
    pub received_ms: i64,
    #[serde(with = "rust_decimal::serde::str")]
    pub bid: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub ask: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub bid_quantity: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub ask_quantity: Decimal,
}

impl Quote {
    pub fn validate(&self) -> Result<()> {
        if !identifier(&self.symbol)
            || self.sequence == 0
            || self.received_ms < 0
            || self.bid <= Decimal::ZERO
            || self.ask < self.bid
            || self.bid_quantity < Decimal::ZERO
            || self.ask_quantity < Decimal::ZERO
        {
            return Err(ExecutionError::InvalidInput);
        }
        Ok(())
    }
}

pub(crate) fn add(a: Decimal, b: Decimal) -> Result<Decimal> {
    a.checked_add(b).ok_or(ExecutionError::Arithmetic)
}
pub(crate) fn sub(a: Decimal, b: Decimal) -> Result<Decimal> {
    a.checked_sub(b).ok_or(ExecutionError::Arithmetic)
}
pub(crate) fn mul(a: Decimal, b: Decimal) -> Result<Decimal> {
    a.checked_mul(b).ok_or(ExecutionError::Arithmetic)
}
pub(crate) fn div(a: Decimal, b: Decimal) -> Result<Decimal> {
    a.checked_div(b).ok_or(ExecutionError::Arithmetic)
}
