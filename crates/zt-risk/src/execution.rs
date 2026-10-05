//! Exact notional collars shared by native execution. Account state is supplied
//! only by the owning engine, never by an untrusted worker request.
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Initial single-symbol Spot/paper collars; leverage and Futures stay disabled.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ExecutionLimits {
    #[serde(with = "rust_decimal::serde::str")]
    pub max_order_notional: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub max_position_notional: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub max_spread_bps: Decimal,
    pub max_orders_per_minute: u32,
    pub max_quote_age_ms: i64,
}

impl ExecutionLimits {
    pub fn valid(&self) -> bool {
        self.max_order_notional > Decimal::ZERO
            && self.max_position_notional > Decimal::ZERO
            && self.max_spread_bps > Decimal::ZERO
            && self.max_spread_bps <= Decimal::from(10_000)
            && self.max_orders_per_minute > 0
            && self.max_quote_age_ms > 0
    }

    /// Arithmetic failure is a rejection, not an overflow-driven risk approval.
    pub fn permits(
        &self,
        order_notional: Decimal,
        projected_position: Decimal,
        bid: Decimal,
        ask: Decimal,
        recent_orders: u32,
    ) -> bool {
        if !self.valid()
            || order_notional <= Decimal::ZERO
            || projected_position < Decimal::ZERO
            || order_notional > self.max_order_notional
            || projected_position > self.max_position_notional
            || recent_orders >= self.max_orders_per_minute
            || bid <= Decimal::ZERO
            || ask < bid
        {
            return false;
        }
        ask.checked_sub(bid)
            .and_then(|spread| spread.checked_mul(Decimal::from(10_000)))
            .and_then(|spread| spread.checked_div(bid))
            .is_some_and(|bps| bps <= self.max_spread_bps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    #[test]
    fn collars_fail_closed_at_boundaries_and_overflow() {
        let limits = ExecutionLimits {
            max_order_notional: dec!(100),
            max_position_notional: dec!(200),
            max_spread_bps: dec!(100),
            max_orders_per_minute: 2,
            max_quote_age_ms: 1000,
        };
        assert!(limits.permits(dec!(100), dec!(200), dec!(100), dec!(101), 1));
        assert!(!limits.permits(dec!(100.01), dec!(200), dec!(100), dec!(101), 1));
        assert!(!limits.permits(dec!(100), dec!(200.01), dec!(100), dec!(101), 1));
        assert!(!limits.permits(dec!(100), dec!(200), dec!(100), dec!(101.01), 1));
        assert!(!limits.permits(dec!(100), dec!(200), dec!(100), dec!(101), 2));
        assert!(!limits.permits(dec!(100), dec!(200), dec!(1), Decimal::MAX, 0));
    }
}
