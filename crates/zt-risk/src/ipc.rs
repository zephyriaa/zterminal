use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RiskCheckRequest {
    pub account_equity: Decimal,
    pub daily_start_equity: Decimal,
    pub max_daily_drawdown: Decimal,
    
    pub risk_target_pct: Decimal,
    pub atr_n: Decimal,
    pub point_value: Decimal,
    
    pub max_dollar_risk: Decimal,
    pub current_gross_exposure: Decimal,
    pub current_net_exposure: Decimal,
    pub max_gross_exposure: Decimal,
    pub max_net_exposure: Decimal,
    
    pub order_side: OrderSide,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum RiskCheckResponse {
    Approved {
        position_size: Decimal,
    },
    Rejected {
        reason: String,
    },
}
