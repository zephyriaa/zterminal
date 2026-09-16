use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum RiskError {
    #[error("ATR must be greater than zero")]
    InvalidAtr,
    #[error("Account equity must be strictly positive")]
    InvalidEquity,
    #[error("Position size calculation resulted in 0")]
    ZeroSize,
    #[error("Hard daily drawdown stop breached")]
    DrawdownExceeded,
    #[error("Max dollar risk per trade exceeded")]
    DollarRiskExceeded,
    #[error("Max position quantity collar exceeded")]
    QuantityCollarExceeded,
    #[error("Order rate limit exceeded (max submissions per 1000ms window)")]
    RateLimitExceeded,
    #[error("Global Kill-Switch is engaged. All routing cancelled.")]
    KillSwitchEngaged,
}
