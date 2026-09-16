use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use rust_decimal::Decimal;

use crate::error::RiskError;
use crate::ipc::{RiskCheckRequest, OrderSide};
use crate::sizing::calculate_position_size;

pub struct RiskGatekeeper {
    kill_switch: AtomicBool,
    rate_limit_window: Duration,
    max_requests_per_window: usize,
    request_timestamps: VecDeque<Instant>,
    min_step_size: Decimal, // Assume global or symbol-specific step size
}

impl RiskGatekeeper {
    pub fn new(max_requests_per_window: usize, rate_limit_window: Duration, min_step_size: Decimal) -> Self {
        Self {
            kill_switch: AtomicBool::new(false),
            rate_limit_window,
            max_requests_per_window,
            request_timestamps: VecDeque::new(),
            min_step_size,
        }
    }

    pub fn engage_kill_switch(&self) {
        self.kill_switch.store(true, Ordering::SeqCst);
    }
    
    pub fn disengage_kill_switch(&self) {
        self.kill_switch.store(false, Ordering::SeqCst);
    }

    pub fn is_kill_switch_engaged(&self) -> bool {
        self.kill_switch.load(Ordering::SeqCst)
    }

    /// Primary entry point. Must be called mutably to update rate limiter.
    pub fn evaluate_order(&mut self, request: &RiskCheckRequest, now: Instant) -> Result<Decimal, RiskError> {
        // E: Global Kill-Switch
        if self.is_kill_switch_engaged() {
            return Err(RiskError::KillSwitchEngaged);
        }

        // D: Rate Limiter
        self.cleanup_rate_limiter(now);
        if self.request_timestamps.len() >= self.max_requests_per_window {
            return Err(RiskError::RateLimitExceeded);
        }
        self.request_timestamps.push_back(now);

        // A: Hard Daily Drawdown Stop
        let max_allowed_drawdown = request.daily_start_equity * request.max_daily_drawdown;
        let current_drawdown = request.daily_start_equity - request.account_equity;
        if current_drawdown > max_allowed_drawdown {
            return Err(RiskError::DrawdownExceeded);
        }

        // Calculate Position Size
        let size = calculate_position_size(
            request.account_equity,
            request.risk_target_pct,
            request.atr_n,
            request.point_value,
            self.min_step_size,
        )?;

        // B: Max Dollar Risk Collar per trade
        let dollar_risk = size * request.atr_n * request.point_value;
        if dollar_risk > request.max_dollar_risk {
            return Err(RiskError::DollarRiskExceeded);
        }

        // C: Max Position Quantity Collar (Gross and Net)
        let new_net_exposure = match request.order_side {
            OrderSide::Buy => request.current_net_exposure + size,
            OrderSide::Sell => request.current_net_exposure - size,
        };
        if new_net_exposure.abs() > request.max_net_exposure {
            return Err(RiskError::QuantityCollarExceeded);
        }

        let new_gross_exposure = request.current_gross_exposure + size;
        if new_gross_exposure > request.max_gross_exposure {
            return Err(RiskError::QuantityCollarExceeded);
        }

        Ok(size)
    }

    fn cleanup_rate_limiter(&mut self, now: Instant) {
        while let Some(&timestamp) = self.request_timestamps.front() {
            // we remove anything outside the window BEFORE now.
            // If `now - timestamp > window`, it's expired.
            if now.checked_duration_since(timestamp).unwrap_or(Duration::ZERO) > self.rate_limit_window {
                self.request_timestamps.pop_front();
            } else {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn default_req() -> RiskCheckRequest {
        RiskCheckRequest {
            account_equity: dec!(10000),
            daily_start_equity: dec!(10000),
            max_daily_drawdown: dec!(0.10), // 10%
            risk_target_pct: dec!(0.01), // 1%
            atr_n: dec!(5),
            point_value: dec!(10),
            max_dollar_risk: dec!(200),
            current_gross_exposure: dec!(0),
            current_net_exposure: dec!(0),
            max_gross_exposure: dec!(10),
            max_net_exposure: dec!(10),
            order_side: OrderSide::Buy,
        }
    }

    #[test]
    fn test_kill_switch() {
        let mut gk = RiskGatekeeper::new(10, Duration::from_secs(1), dec!(1));
        gk.engage_kill_switch();
        let res = gk.evaluate_order(&default_req(), Instant::now());
        assert_eq!(res, Err(RiskError::KillSwitchEngaged));
    }

    #[test]
    fn test_rate_limiter() {
        let mut gk = RiskGatekeeper::new(2, Duration::from_secs(1), dec!(1));
        let now = Instant::now();
        
        // 1st request
        assert!(gk.evaluate_order(&default_req(), now).is_ok());
        // 2nd request
        assert!(gk.evaluate_order(&default_req(), now).is_ok());
        // 3rd request (exceeds limit)
        assert_eq!(gk.evaluate_order(&default_req(), now), Err(RiskError::RateLimitExceeded));
        
        // Advance time past window
        let later = now + Duration::from_millis(1001);
        assert!(gk.evaluate_order(&default_req(), later).is_ok());
    }

    #[test]
    fn test_drawdown_exceeded() {
        let mut gk = RiskGatekeeper::new(10, Duration::from_secs(1), dec!(1));
        let mut req = default_req();
        // Start = 10000, Drawdown max = 1000. Current equity = 8900 -> Drawdown = 1100 > 1000
        req.account_equity = dec!(8900);
        let res = gk.evaluate_order(&req, Instant::now());
        assert_eq!(res, Err(RiskError::DrawdownExceeded));
    }

    #[test]
    fn test_dollar_risk_exceeded() {
        let mut gk = RiskGatekeeper::new(10, Duration::from_secs(1), dec!(1));
        let mut req = default_req();
        req.max_dollar_risk = dec!(50); // Calculated risk is 100 (Size 2 * 5 * 10)
        let res = gk.evaluate_order(&req, Instant::now());
        assert_eq!(res, Err(RiskError::DollarRiskExceeded));
    }

    #[test]
    fn test_quantity_collar() {
        let mut gk = RiskGatekeeper::new(10, Duration::from_secs(1), dec!(1));
        let mut req = default_req();
        // Current size will be 2.
        req.max_net_exposure = dec!(1);
        let res = gk.evaluate_order(&req, Instant::now());
        assert_eq!(res, Err(RiskError::QuantityCollarExceeded));
    }
}
