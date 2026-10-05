use crate::model::{add, div, identifier, mul, sub};
use crate::{
    ExecutionError, ExecutionMode, IntentState, Journal, LimitOrder, Quote, Result, Side,
    SymbolInfo,
};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use zt_risk::{execution::ExecutionLimits, RiskGatekeeper};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PaperConfig {
    pub account_id: String,
    pub deployment_id: String,
    pub instrument: SymbolInfo,
    #[serde(with = "rust_decimal::serde::str")]
    pub initial_cash: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub fee_bps: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub slippage_bps: Decimal,
    pub latency_ms: i64,
    pub order_ttl_ms: i64,
    pub limits: ExecutionLimits,
}

impl PaperConfig {
    fn validate(&self) -> Result<()> {
        self.instrument.validate()?;
        if !identifier(&self.account_id)
            || !identifier(&self.deployment_id)
            || self.initial_cash <= Decimal::ZERO
            || self.fee_bps < Decimal::ZERO
            || self.fee_bps >= Decimal::from(10_000)
            || self.slippage_bps < Decimal::ZERO
            || self.slippage_bps >= Decimal::from(10_000)
            || self.latency_ms < 0
            || self.order_ttl_ms <= self.latency_ms
            || !self.limits.valid()
        {
            return Err(ExecutionError::InvalidInput);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaperSnapshot {
    pub mode: ExecutionMode,
    #[serde(with = "rust_decimal::serde::str")]
    pub cash: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub quantity: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub fees: Decimal,
    pub fill_count: u64,
    pub active_orders: usize,
    pub paused: bool,
}

/// Single-owner deterministic Spot limit simulation. No network/vault dependency.
/// It starts paused and requires a new quote and explicit resume on every restart.
pub struct PaperEngine {
    journal: Journal,
    config: PaperConfig,
    quote: Option<Quote>,
    paused: bool,
    kill_switch: RiskGatekeeper,
}

impl PaperEngine {
    pub fn open(mut journal: Journal, config: PaperConfig, mode: ExecutionMode) -> Result<Self> {
        mode.require_enabled()?;
        config.validate()?;
        journal.quarantine_uncertain()?;
        let encoded = serde_json::to_string(&config).map_err(|_| ExecutionError::InvalidInput)?;
        let previous: Option<String> = journal
            .db
            .query_row(
                "SELECT config_json FROM paper_balance WHERE id=1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        match previous {
            Some(value) if value != encoded => return Err(ExecutionError::InvalidInput),
            Some(_) => {}
            None => {
                let records: i64 = journal.db.query_row(
                    "SELECT (SELECT count(*) FROM intents) + (SELECT count(*) FROM paper_fills)",
                    [],
                    |r| r.get(0),
                )?;
                if records != 0 {
                    return Err(ExecutionError::Schema);
                }
                journal.db.execute(
                    "INSERT INTO paper_balance VALUES(1,?1,?2,'0','0','0',-1)",
                    params![encoded, config.initial_cash.to_string()],
                )?;
            }
        }
        if journal.active()?.iter().any(|i| {
            i.account_id != config.account_id
                || i.deployment_id != config.deployment_id
                || i.order.symbol != config.instrument.symbol
        }) {
            return Err(ExecutionError::NotReady);
        }
        // Never replay queued signals across process restarts, even in paper.
        journal.db.execute(
            "UPDATE intents SET state='cancelled' WHERE state='prepared'",
            [],
        )?;
        let kill_switch = RiskGatekeeper::new(
            config.limits.max_orders_per_minute as usize,
            Duration::from_secs(60),
            config.instrument.quantity_step,
        );
        Ok(Self {
            journal,
            config,
            quote: None,
            paused: true,
            kill_switch,
        })
    }

    pub fn snapshot(&self) -> Result<PaperSnapshot> {
        let (cash, quantity, fees): (String, String, String) = self.journal.db.query_row(
            "SELECT cash,quantity,fees FROM paper_balance WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        let fill_count: i64 =
            self.journal
                .db
                .query_row("SELECT count(*) FROM paper_fills", [], |r| r.get(0))?;
        Ok(PaperSnapshot {
            mode: ExecutionMode::Paper,
            cash: Journal::decimal(&cash)?,
            quantity: Journal::decimal(&quantity)?,
            fees: Journal::decimal(&fees)?,
            fill_count: u64::try_from(fill_count).map_err(|_| ExecutionError::Schema)?,
            active_orders: self.journal.active()?.len(),
            paused: self.paused,
        })
    }

    fn healthy(&self, now: i64) -> Result<&Quote> {
        if self.paused || self.kill_switch.is_kill_switch_engaged() {
            return Err(ExecutionError::NotReady);
        }
        self.fresh(now)
    }

    fn fresh(&self, now: i64) -> Result<&Quote> {
        let quote = self.quote.as_ref().ok_or(ExecutionError::NotReady)?;
        if now < quote.received_ms
            || now
                .checked_sub(quote.received_ms)
                .ok_or(ExecutionError::Arithmetic)?
                > self.config.limits.max_quote_age_ms
        {
            return Err(ExecutionError::NotReady);
        }
        Ok(quote)
    }

    /// Explicit user/engine action, not automatic on a new quote or restart.
    pub fn resume(&mut self, now: i64) -> Result<()> {
        self.fresh(now)?;
        if self.kill_switch.is_kill_switch_engaged()
            || self.journal.active()?.iter().any(|i| {
                matches!(
                    i.state,
                    IntentState::Dispatching | IntentState::Unknown | IntentState::Quarantined
                )
            })
        {
            return Err(ExecutionError::NotReady);
        }
        self.paused = false;
        Ok(())
    }

    /// Pause/revocation clears unsent decisions; positions are never liquidated.
    pub fn pause(&mut self) -> Result<()> {
        self.paused = true;
        self.quote = None;
        self.journal.db.execute(
            "UPDATE intents SET state='cancelled' WHERE state='prepared'",
            [],
        )?;
        Ok(())
    }

    pub fn engage_kill_switch(&mut self) -> Result<()> {
        self.kill_switch.engage_kill_switch();
        self.pause()
    }

    pub fn cancel_owned(&mut self, client_id: &str) -> Result<()> {
        let changed = self.journal.db.execute(
            "UPDATE intents SET state='cancelled' WHERE client_id=?1
            AND account_id=?2 AND deployment_id=?3 AND state='prepared'",
            params![client_id, self.config.account_id, self.config.deployment_id],
        )?;
        if changed != 1 {
            return Err(ExecutionError::Transition);
        }
        Ok(())
    }

    pub fn place_limit(&mut self, order: LimitOrder, now: i64) -> Result<String> {
        let quote = self.healthy(now)?;
        let notional = self.config.instrument.validate_order(&order)?;
        let snapshot = self.snapshot()?;
        let mut reserved_cash = Decimal::ZERO;
        let mut reserved_quantity = Decimal::ZERO;
        let mut pending_buys = Decimal::ZERO;
        for intent in self.journal.active()? {
            // Never combine unknown/manual ownership with simulated account state.
            if intent.account_id != self.config.account_id
                || intent.deployment_id != self.config.deployment_id
                || intent.order.symbol != self.config.instrument.symbol
                || intent.state != IntentState::Prepared
            {
                return Err(ExecutionError::NotReady);
            }
            let filled = self.filled_quantity(&intent.client_id)?;
            let remaining = sub(intent.order.quantity, filled)?;
            match intent.order.side {
                Side::Buy => {
                    pending_buys = add(pending_buys, remaining)?;
                    reserved_cash = add(
                        reserved_cash,
                        self.with_fee(mul(remaining, intent.order.price)?)?,
                    )?;
                }
                Side::Sell => reserved_quantity = add(reserved_quantity, remaining)?,
            }
        }
        let projected = mul(
            add(
                snapshot.quantity,
                add(
                    pending_buys,
                    if order.side == Side::Buy {
                        order.quantity
                    } else {
                        Decimal::ZERO
                    },
                )?,
            )?,
            order.price.max(quote.ask),
        )?;
        let recent: u32 = self.journal.db.query_row(
            "SELECT count(*) FROM intents WHERE account_id=?1
            AND ready_ms>=?2",
            params![
                self.config.account_id,
                now.saturating_sub(60_000)
                    .saturating_add(self.config.latency_ms)
            ],
            |r| r.get(0),
        )?;
        if !self
            .config
            .limits
            .permits(notional, projected, quote.bid, quote.ask, recent)
        {
            return Err(ExecutionError::Risk);
        }
        match order.side {
            Side::Buy if self.with_fee(notional)? > sub(snapshot.cash, reserved_cash)? => {
                return Err(ExecutionError::Balance)
            }
            Side::Sell if order.quantity > sub(snapshot.quantity, reserved_quantity)? => {
                return Err(ExecutionError::Balance)
            }
            _ => {}
        }
        let ready = now
            .checked_add(self.config.latency_ms)
            .ok_or(ExecutionError::Arithmetic)?;
        let expires = now
            .checked_add(self.config.order_ttl_ms)
            .ok_or(ExecutionError::Arithmetic)?;
        self.journal.prepare(
            &self.config.account_id,
            &self.config.deployment_id,
            ExecutionMode::Paper,
            &order,
            ready,
            expires,
        )
    }

    fn with_fee(&self, notional: Decimal) -> Result<Decimal> {
        add(
            notional,
            div(mul(notional, self.config.fee_bps)?, Decimal::from(10_000))?,
        )
    }

    fn filled_quantity(&self, id: &str) -> Result<Decimal> {
        let mut query = self
            .journal
            .db
            .prepare("SELECT quantity FROM paper_fills WHERE client_id=?1")?;
        let rows = query.query_map([id], |r| r.get::<_, String>(0))?;
        let mut total = Decimal::ZERO;
        for row in rows {
            total = add(total, Journal::decimal(&row?)?)?;
        }
        Ok(total)
    }

    /// A quote is consumed once, with bounded total liquidity across all orders.
    /// Quote cursor, fills and balances commit together: replay cannot double fill.
    pub fn on_quote(&mut self, quote: Quote, now: i64) -> Result<usize> {
        quote.validate()?;
        if quote.symbol != self.config.instrument.symbol
            || now < quote.received_ms
            || now
                .checked_sub(quote.received_ms)
                .ok_or(ExecutionError::Arithmetic)?
                > self.config.limits.max_quote_age_ms
        {
            return Err(ExecutionError::NotReady);
        }
        let (seq, received): (String, i64) = self.journal.db.query_row(
            "SELECT last_sequence,last_received_ms FROM paper_balance WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        let sequence = seq.parse::<u64>().map_err(|_| ExecutionError::Schema)?;
        if quote.sequence <= sequence {
            return Ok(0);
        }
        if quote.received_ms < received {
            self.pause()?;
            return Err(ExecutionError::NotReady);
        }
        if (sequence != 0 && quote.sequence != sequence.saturating_add(1))
            || (received >= 0 && quote.received_ms - received > self.config.limits.max_quote_age_ms)
        {
            self.pause()?; // A feed gap/wake clears old queued signals.
        }
        let snapshot = self.snapshot()?;
        let mut cash = snapshot.cash;
        let mut quantity = snapshot.quantity;
        let mut fees = snapshot.fees;
        let mut bid_liquidity = quote.bid_quantity;
        let mut ask_liquidity = quote.ask_quantity;
        let mut actions = Vec::new();
        let mut expired = Vec::new();
        if !self.paused && !self.kill_switch.is_kill_switch_engaged() {
            for intent in self.journal.active()? {
                if intent.state != IntentState::Prepared
                    || intent.account_id != self.config.account_id
                    || intent.deployment_id != self.config.deployment_id
                {
                    return Err(ExecutionError::NotReady);
                }
                if now >= intent.expires_ms {
                    expired.push(intent.client_id);
                    continue;
                }
                // A quote predating the simulated routing deadline cannot fill.
                if quote.received_ms < intent.ready_ms {
                    continue;
                }
                let remaining = sub(
                    intent.order.quantity,
                    self.filled_quantity(&intent.client_id)?,
                )?;
                let (raw_price, liquidity, direction) = match intent.order.side {
                    Side::Buy => (quote.ask, &mut ask_liquidity, Decimal::ONE),
                    Side::Sell => (quote.bid, &mut bid_liquidity, -Decimal::ONE),
                };
                let slippage = div(
                    mul(self.config.slippage_bps, direction)?,
                    Decimal::from(10_000),
                )?;
                let raw_execution = mul(raw_price, add(Decimal::ONE, slippage)?)?;
                let ticks = div(raw_execution, self.config.instrument.price_tick)?;
                let price = mul(
                    match intent.order.side {
                        Side::Buy => ticks.ceil(),
                        Side::Sell => ticks.floor(),
                    },
                    self.config.instrument.price_tick,
                )?;
                if price <= Decimal::ZERO
                    || (intent.order.side == Side::Buy && price > intent.order.price)
                    || (intent.order.side == Side::Sell && price < intent.order.price)
                {
                    continue;
                }
                let available = mul(
                    div(
                        (*liquidity).min(remaining),
                        self.config.instrument.quantity_step,
                    )?
                    .floor(),
                    self.config.instrument.quantity_step,
                )?;
                if available <= Decimal::ZERO {
                    continue;
                }
                let notional = mul(available, price)?;
                let fee = div(mul(notional, self.config.fee_bps)?, Decimal::from(10_000))?;
                let position_after = match intent.order.side {
                    Side::Buy => add(quantity, available)?,
                    Side::Sell => sub(quantity, available)?,
                };
                // Recheck dispatch health/spread/notional: changed market cannot bypass collars.
                if !self.config.limits.permits(
                    notional,
                    mul(position_after, quote.ask)?,
                    quote.bid,
                    quote.ask,
                    0,
                ) {
                    continue;
                }
                match intent.order.side {
                    Side::Buy => {
                        let cost = add(notional, fee)?;
                        if cost > cash {
                            return Err(ExecutionError::Balance);
                        }
                        cash = sub(cash, cost)?;
                    }
                    Side::Sell => {
                        if available > quantity {
                            return Err(ExecutionError::Balance);
                        }
                        cash = add(cash, sub(notional, fee)?)?;
                    }
                }
                quantity = position_after;
                fees = add(fees, fee)?;
                *liquidity = sub(*liquidity, available)?;
                actions.push((
                    intent.client_id,
                    available,
                    price,
                    fee,
                    available == remaining,
                ));
            }
        }
        let tx = self
            .journal
            .db
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        for id in expired {
            tx.execute(
                "UPDATE intents SET state='cancelled' WHERE client_id=?1 AND state='prepared'",
                [id],
            )?;
        }
        for (id, size, price, fee, complete) in &actions {
            tx.execute(
                "INSERT INTO paper_fills VALUES(?1,?2,?3,?4,?5)",
                params![
                    id,
                    quote.sequence.to_string(),
                    size.to_string(),
                    price.to_string(),
                    fee.to_string()
                ],
            )?;
            if *complete {
                tx.execute("UPDATE intents SET state='filled',exchange_id=?2 WHERE client_id=?1 AND state='prepared'",
                params![id,format!("paper_{id}")])?;
            }
        }
        tx.execute("UPDATE paper_balance SET cash=?1,quantity=?2,fees=?3,last_sequence=?4,last_received_ms=?5 WHERE id=1",
            params![cash.to_string(),quantity.to_string(),fees.to_string(),quote.sequence.to_string(),quote.received_ms])?;
        tx.commit()?;
        self.quote = Some(quote);
        Ok(actions.len())
    }
}
