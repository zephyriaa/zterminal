use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Bar {
    pub t: i64,
    pub o: Decimal,
    pub h: Decimal,
    pub l: Decimal,
    pub c: Decimal,
    pub v: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Action {
    EnterLong,
    EnterShort,
    Close,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Intent {
    pub bar_index: usize,
    pub action: Action,
    pub quantity: Decimal,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecutionPolicy {
    pub fill_model: String,
    pub commission_per_contract: Decimal,
    pub slippage_ticks: Decimal,
    pub spread_ticks: Decimal,
    pub tick_size: Decimal,
    pub multiplier: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Trade {
    pub side: String,
    pub entry_time: i64,
    pub entry_price: Decimal,
    pub exit_time: i64,
    pub exit_price: Decimal,
    pub quantity: Decimal,
    pub pnl: Decimal,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayResult {
    pub trades: Vec<Trade>,
    pub final_equity: Decimal,
    pub result_hash: String,
}

#[derive(Debug, Error, PartialEq)]
pub enum EngineError {
    #[error("the engine accepts only the next_bar_open fill model")]
    UnsupportedFillModel,
    #[error("bar set is empty")]
    EmptyBars,
    #[error("intent at bar {bar_index} cannot be filled without a subsequent observed bar")]
    FutureBarIntent { bar_index: usize },
    #[error("intent at bar {bar_index} has an invalid quantity")]
    InvalidQuantity { bar_index: usize },
    #[error("intent at bar {bar_index} is not in deterministic order")]
    OutOfOrderIntent { bar_index: usize },
}

#[derive(Debug, Clone)]
struct Position {
    side: Action,
    entry_time: i64,
    entry_price: Decimal,
    quantity: Decimal,
    reason: String,
}

pub fn replay(
    bars: &[Bar],
    intents: &[Intent],
    initial_capital: Decimal,
    policy: &ExecutionPolicy,
) -> Result<ReplayResult, EngineError> {
    if bars.is_empty() {
        return Err(EngineError::EmptyBars);
    }
    if policy.fill_model != "next_bar_open" {
        return Err(EngineError::UnsupportedFillModel);
    }

    let mut previous = None;
    for intent in intents {
        if intent.quantity <= Decimal::ZERO {
            return Err(EngineError::InvalidQuantity {
                bar_index: intent.bar_index,
            });
        }
        if intent.bar_index + 1 >= bars.len() {
            return Err(EngineError::FutureBarIntent {
                bar_index: intent.bar_index,
            });
        }
        if previous.is_some_and(|last| intent.bar_index < last) {
            return Err(EngineError::OutOfOrderIntent {
                bar_index: intent.bar_index,
            });
        }
        previous = Some(intent.bar_index);
    }

    let mut cash = initial_capital;
    let mut position: Option<Position> = None;
    let mut trades = Vec::new();

    for intent in intents {
        let fill_bar = &bars[intent.bar_index + 1];
        match intent.action {
            Action::EnterLong | Action::EnterShort => {
                if let Some(open) = position.take() {
                    let exit_price = fill_price(fill_bar.o, &open.side, false, policy);
                    cash += close_position(
                        &open,
                        fill_bar.t,
                        exit_price,
                        &intent.reason,
                        policy,
                        &mut trades,
                    );
                }
                let entry_price = fill_price(fill_bar.o, &intent.action, true, policy);
                cash -= policy.commission_per_contract * intent.quantity;
                position = Some(Position {
                    side: intent.action.clone(),
                    entry_time: fill_bar.t,
                    entry_price,
                    quantity: intent.quantity,
                    reason: intent.reason.clone(),
                });
            }
            Action::Close => {
                if let Some(open) = position.take() {
                    let exit_price = fill_price(fill_bar.o, &open.side, false, policy);
                    cash += close_position(
                        &open,
                        fill_bar.t,
                        exit_price,
                        &intent.reason,
                        policy,
                        &mut trades,
                    );
                }
            }
        }
    }

    if let Some(open) = position.take() {
        let last = bars.last().expect("validated non-empty bars");
        let exit_price = fill_price(last.c, &open.side, false, policy);
        cash += close_position(
            &open,
            last.t,
            exit_price,
            "end_of_observed_data",
            policy,
            &mut trades,
        );
    }

    let hash_input = serde_json::to_vec(&(bars, intents, initial_capital, policy, &trades, cash))
        .expect("serializable deterministic inputs");
    let result_hash = format!("{:x}", Sha256::digest(hash_input));
    Ok(ReplayResult {
        trades,
        final_equity: cash,
        result_hash,
    })
}

fn fill_price(base: Decimal, side: &Action, entering: bool, policy: &ExecutionPolicy) -> Decimal {
    let friction = (policy.slippage_ticks + policy.spread_ticks) * policy.tick_size;
    let buys = matches!(side, Action::EnterLong);
    if (buys && entering) || (!buys && !entering) {
        base + friction
    } else {
        base - friction
    }
}

fn close_position(
    position: &Position,
    exit_time: i64,
    exit_price: Decimal,
    reason: &str,
    policy: &ExecutionPolicy,
    trades: &mut Vec<Trade>,
) -> Decimal {
    let gross = if matches!(position.side, Action::EnterLong) {
        (exit_price - position.entry_price) * position.quantity * policy.multiplier
    } else {
        (position.entry_price - exit_price) * position.quantity * policy.multiplier
    };
    let pnl = gross - policy.commission_per_contract * position.quantity;
    trades.push(Trade {
        side: if matches!(position.side, Action::EnterLong) {
            "long".into()
        } else {
            "short".into()
        },
        entry_time: position.entry_time,
        entry_price: position.entry_price,
        exit_time,
        exit_price,
        quantity: position.quantity,
        pnl,
        reason: format!("{}:{}", position.reason, reason),
    });
    pnl
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn bars() -> Vec<Bar> {
        vec![
            Bar {
                t: 1,
                o: dec!(100),
                h: dec!(101),
                l: dec!(99),
                c: dec!(100),
                v: dec!(1),
            },
            Bar {
                t: 2,
                o: dec!(101),
                h: dec!(103),
                l: dec!(100),
                c: dec!(102),
                v: dec!(1),
            },
            Bar {
                t: 3,
                o: dec!(103),
                h: dec!(104),
                l: dec!(101),
                c: dec!(102),
                v: dec!(1),
            },
        ]
    }

    fn policy() -> ExecutionPolicy {
        ExecutionPolicy {
            fill_model: "next_bar_open".into(),
            commission_per_contract: dec!(0),
            slippage_ticks: dec!(0),
            spread_ticks: dec!(0),
            tick_size: dec!(1),
            multiplier: dec!(1),
        }
    }

    #[test]
    fn executes_signals_on_the_next_observed_open() {
        let intents = vec![
            Intent {
                bar_index: 0,
                action: Action::EnterLong,
                quantity: dec!(1),
                reason: "entry".into(),
            },
            Intent {
                bar_index: 1,
                action: Action::Close,
                quantity: dec!(1),
                reason: "exit".into(),
            },
        ];
        let result = replay(&bars(), &intents, dec!(1000), &policy()).unwrap();
        assert_eq!(result.trades[0].entry_price, dec!(101));
        assert_eq!(result.trades[0].exit_price, dec!(103));
        assert_eq!(result.final_equity, dec!(1002));
    }

    #[test]
    fn rejects_future_bar_execution() {
        let intents = vec![Intent {
            bar_index: 2,
            action: Action::EnterLong,
            quantity: dec!(1),
            reason: "bad".into(),
        }];
        assert_eq!(
            replay(&bars(), &intents, dec!(1000), &policy()).unwrap_err(),
            EngineError::FutureBarIntent { bar_index: 2 }
        );
    }

    #[test]
    fn produces_the_same_hash_for_the_same_inputs() {
        let intents = vec![Intent {
            bar_index: 0,
            action: Action::EnterLong,
            quantity: dec!(1),
            reason: "entry".into(),
        }];
        let first = replay(&bars(), &intents, dec!(1000), &policy()).unwrap();
        let second = replay(&bars(), &intents, dec!(1000), &policy()).unwrap();
        assert_eq!(first.result_hash, second.result_hash);
    }
}
