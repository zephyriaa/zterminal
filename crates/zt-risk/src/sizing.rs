use rust_decimal::Decimal;
use crate::error::RiskError;

/// Volatility Sizing Model
/// Position Size = floor((Account Equity * Risk Target %) / (ATR(n) * Point Value))
pub fn calculate_position_size(
    account_equity: Decimal,
    risk_target_pct: Decimal,
    atr_n: Decimal,
    point_value: Decimal,
    min_step_size: Decimal,
) -> Result<Decimal, RiskError> {
    if account_equity <= Decimal::ZERO {
        return Err(RiskError::InvalidEquity);
    }
    if atr_n <= Decimal::ZERO {
        return Err(RiskError::InvalidAtr);
    }
    
    let risk_amount = account_equity * risk_target_pct;
    let risk_per_contract = atr_n * point_value;
    
    if risk_per_contract <= Decimal::ZERO {
        return Err(RiskError::InvalidAtr);
    }
    
    let exact_size = risk_amount / risk_per_contract;
    
    // Floor to min step size. e.g., exact=1.23, step=0.1 -> 1.2
    let steps = exact_size / min_step_size;
    let floored_steps = steps.floor();
    let position_size = floored_steps * min_step_size;
    
    if position_size <= Decimal::ZERO {
        return Err(RiskError::ZeroSize);
    }
    
    Ok(position_size)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_valid_sizing() {
        // Equity=10000, Risk=0.01 (100 risk)
        // ATR=5, PtVal=10 (50 risk/ct)
        // Size = 100/50 = 2
        let size = calculate_position_size(dec!(10000), dec!(0.01), dec!(5), dec!(10), dec!(1)).unwrap();
        assert_eq!(size, dec!(2));
    }

    #[test]
    fn test_floor_step() {
        // Exact size: 2.5. Step size: 1.0 -> 2.0
        let size = calculate_position_size(dec!(12500), dec!(0.01), dec!(5), dec!(10), dec!(1)).unwrap();
        assert_eq!(size, dec!(2));
        
        // Exact size: 2.55. Step size: 0.1 -> 2.5
        let size = calculate_position_size(dec!(12750), dec!(0.01), dec!(5), dec!(10), dec!(0.1)).unwrap();
        assert_eq!(size, dec!(2.5));
    }

    #[test]
    fn test_zero_atr() {
        let res = calculate_position_size(dec!(10000), dec!(0.01), dec!(0), dec!(10), dec!(1));
        assert_eq!(res, Err(RiskError::InvalidAtr));
    }

    #[test]
    fn test_negative_equity() {
        let res = calculate_position_size(dec!(-1000), dec!(0.01), dec!(5), dec!(10), dec!(1));
        assert_eq!(res, Err(RiskError::InvalidEquity));
    }
}
