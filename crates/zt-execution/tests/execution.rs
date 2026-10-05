//! Execution invariants exercised through persisted public engine interfaces.
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use tempfile::TempDir;
use zt_execution::*;
use zt_risk::execution::ExecutionLimits;

fn config() -> PaperConfig {
    PaperConfig {
        account_id: "paper_account".into(),
        deployment_id: "strategy_1".into(),
        instrument: SymbolInfo {
            symbol: "BTCUSDT".into(),
            price_tick: dec!(0.01),
            quantity_step: dec!(0.001),
            min_quantity: dec!(0.001),
            max_quantity: dec!(100),
            min_notional: dec!(1),
        },
        initial_cash: dec!(10000),
        fee_bps: dec!(10),
        slippage_bps: dec!(0),
        latency_ms: 100,
        order_ttl_ms: 5000,
        limits: ExecutionLimits {
            max_order_notional: dec!(5000),
            max_position_notional: dec!(10000),
            max_spread_bps: dec!(100),
            max_orders_per_minute: 10,
            max_quote_age_ms: 1000,
        },
    }
}
fn order(side: Side, quantity: Decimal, price: Decimal) -> LimitOrder {
    LimitOrder {
        symbol: "BTCUSDT".into(),
        side,
        quantity,
        price,
    }
}
fn quote(sequence: u64, time: i64) -> Quote {
    Quote {
        symbol: "BTCUSDT".into(),
        sequence,
        received_ms: time,
        bid: dec!(99.99),
        ask: dec!(100),
        bid_quantity: dec!(100),
        ask_quantity: dec!(100),
    }
}
fn engine(directory: &TempDir) -> PaperEngine {
    PaperEngine::open(
        Journal::open(directory.path().join("execution.sqlite3")).unwrap(),
        config(),
        ExecutionMode::Paper,
    )
    .unwrap()
}

#[test]
fn journal_commits_before_claim_and_never_reclaims_unknown() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("execution.sqlite3");
    let id;
    {
        let mut ledger = Journal::open(&path).unwrap();
        assert_eq!(
            ledger.claim_dispatch("missing"),
            Err(ExecutionError::Transition)
        );
        id = ledger
            .prepare(
                "account",
                "deployment",
                ExecutionMode::Paper,
                &order(Side::Buy, dec!(1), dec!(100)),
                100,
                1000,
            )
            .unwrap();
        assert_eq!(ledger.intent(&id).unwrap().state, IntentState::Prepared);
    }
    {
        let mut ledger = Journal::open(&path).unwrap();
        assert_eq!(ledger.intent(&id).unwrap().state, IntentState::Prepared);
        ledger.claim_dispatch(&id).unwrap();
        assert_eq!(ledger.claim_dispatch(&id), Err(ExecutionError::Transition));
        ledger.record_unknown(&id).unwrap();
    }
    let mut ledger = Journal::open(&path).unwrap();
    assert_eq!(ledger.quarantine_uncertain().unwrap(), 1);
    assert_eq!(ledger.claim_dispatch(&id), Err(ExecutionError::Transition));
    ledger.record_acknowledgement(&id, "exchange123").unwrap();
    ledger.record_acknowledgement(&id, "exchange123").unwrap();
    assert_eq!(
        ledger.record_acknowledgement(&id, "different_exchange_id"),
        Err(ExecutionError::Transition)
    );
    assert_eq!(
        ledger.intent(&id).unwrap().exchange_id.as_deref(),
        Some("exchange123")
    );
    assert_eq!(ledger.claim_dispatch(&id), Err(ExecutionError::Transition));
    assert_eq!(ledger.record_unknown(&id), Err(ExecutionError::Transition));
}

#[test]
fn journal_owns_file_exclusively_and_rejects_foreign_or_future_schema() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("execution.sqlite3");
    let first = Journal::open(&path).unwrap();
    assert!(Journal::open(&path).is_err());
    drop(first);
    assert!(Journal::open(&path).is_ok());
    let foreign = dir.path().join("research.sqlite3");
    let db = rusqlite::Connection::open(&foreign).unwrap();
    db.execute_batch("CREATE TABLE results (id TEXT); PRAGMA user_version=5;")
        .unwrap();
    drop(db);
    assert!(matches!(
        Journal::open(foreign),
        Err(ExecutionError::Schema)
    ));
}

#[test]
fn persistent_ids_unique_and_raw_secret_fields_rejected() {
    let dir = TempDir::new().unwrap();
    let mut journal = Journal::open(dir.path().join("execution.sqlite3")).unwrap();
    let mut ids = std::collections::HashSet::new();
    for _ in 0..100 {
        assert!(ids.insert(
            journal
                .prepare(
                    "account",
                    "deployment",
                    ExecutionMode::Paper,
                    &order(Side::Buy, dec!(1), dec!(100)),
                    100,
                    1000
                )
                .unwrap()
        ));
    }
    assert!(serde_json::from_str::<LimitOrder>(
        r#"{"symbol":"BTCUSDT","side":"Buy","quantity":"1","price":"100","secret_key":"SENTINEL"}"#
    )
    .is_err());
    assert!(serde_json::from_str::<LimitOrder>(
        r#"{"symbol":"BTCUSDT","side":"Buy","quantity":1.0,"price":100}"#
    )
    .is_err());
    journal
        .set_credential_reference("account", "0123456789abcdef0123456789abcdef")
        .unwrap();
    assert_eq!(
        journal.set_credential_reference("account", "API-SECRET"),
        Err(ExecutionError::InvalidInput)
    );
    journal.remove_credential_reference("account").unwrap();
}

#[test]
fn both_live_modes_fail_closed() {
    let dir = TempDir::new().unwrap();
    for mode in [ExecutionMode::SpotLive, ExecutionMode::FuturesLive] {
        assert_eq!(mode.require_enabled(), Err(ExecutionError::LiveDisabled));
        let journal = Journal::open(dir.path().join(format!("{mode:?}.sqlite3"))).unwrap();
        assert!(matches!(
            PaperEngine::open(journal, config(), mode),
            Err(ExecutionError::LiveDisabled)
        ));
    }
}

#[test]
fn invalid_filters_and_overflow_never_round_or_panic() {
    let info = config().instrument;
    assert_eq!(
        info.validate_order(&order(Side::Buy, dec!(0.0011), dec!(100))),
        Err(ExecutionError::Filter)
    );
    assert_eq!(
        info.validate_order(&order(Side::Buy, dec!(1), dec!(100.001))),
        Err(ExecutionError::Filter)
    );
    assert_eq!(
        info.validate_order(&order(Side::Buy, dec!(0.001), dec!(100))),
        Err(ExecutionError::Filter)
    );
    let mut no_tick = info.clone();
    no_tick.price_tick = Decimal::ZERO;
    assert_eq!(
        no_tick.validate_order(&order(Side::Buy, dec!(1), dec!(100))),
        Err(ExecutionError::InvalidInput)
    );
    let mut huge = info.clone();
    huge.price_tick = Decimal::ONE;
    huge.quantity_step = Decimal::ONE;
    assert_eq!(
        huge.validate_order(&order(Side::Buy, dec!(100), Decimal::MAX)),
        Err(ExecutionError::Arithmetic)
    );
}

#[test]
fn paper_fills_after_latency_with_exact_fees_and_deduplicates() {
    let dir = TempDir::new().unwrap();
    let mut engine = engine(&dir);
    assert_eq!(
        engine.place_limit(order(Side::Buy, dec!(1), dec!(100)), 0),
        Err(ExecutionError::NotReady)
    );
    engine.on_quote(quote(1, 0), 0).unwrap();
    engine.resume(0).unwrap();
    engine
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
        .unwrap();
    assert_eq!(engine.on_quote(quote(2, 99), 99).unwrap(), 0);
    assert_eq!(engine.on_quote(quote(3, 100), 100).unwrap(), 1);
    let snapshot = engine.snapshot().unwrap();
    assert_eq!(snapshot.cash, dec!(9899.9));
    assert_eq!(snapshot.quantity, dec!(1));
    assert_eq!(snapshot.fees, dec!(0.1));
    assert_eq!(snapshot.fill_count, 1);
    assert_eq!(engine.on_quote(quote(3, 100), 100).unwrap(), 0);
    assert_eq!(engine.snapshot().unwrap(), snapshot);
}

#[test]
fn finite_liquidity_shared_and_partial_fills_resume_without_double_counting() {
    let dir = TempDir::new().unwrap();
    let mut engine = engine(&dir);
    engine.on_quote(quote(1, 0), 0).unwrap();
    engine.resume(0).unwrap();
    engine
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
        .unwrap();
    engine
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
        .unwrap();
    let mut event = quote(2, 100);
    event.ask_quantity = dec!(1.5);
    assert_eq!(engine.on_quote(event.clone(), 100).unwrap(), 2);
    assert_eq!(engine.snapshot().unwrap().quantity, dec!(1.5));
    assert_eq!(engine.snapshot().unwrap().active_orders, 1);
    assert_eq!(engine.on_quote(event, 100).unwrap(), 0);
    assert_eq!(engine.on_quote(quote(3, 200), 200).unwrap(), 1);
    assert_eq!(engine.snapshot().unwrap().quantity, dec!(2));
    assert_eq!(engine.snapshot().unwrap().active_orders, 0);
}

#[test]
fn reserves_cash_and_inventory_across_concurrent_intents() {
    let dir = TempDir::new().unwrap();
    let mut engine = engine(&dir);
    engine.on_quote(quote(1, 0), 0).unwrap();
    engine.resume(0).unwrap();
    engine
        .place_limit(order(Side::Buy, dec!(49), dec!(100)), 0)
        .unwrap();
    engine
        .place_limit(order(Side::Buy, dec!(49), dec!(100)), 0)
        .unwrap();
    assert_eq!(
        engine.place_limit(order(Side::Buy, dec!(3), dec!(100)), 0),
        Err(ExecutionError::Risk)
    );
    assert_eq!(
        engine.place_limit(order(Side::Buy, dec!(2), dec!(100)), 0),
        Err(ExecutionError::Balance)
    );
    assert_eq!(
        engine.place_limit(order(Side::Sell, dec!(1), dec!(100)), 0),
        Err(ExecutionError::Balance)
    );
    engine.on_quote(quote(2, 100), 100).unwrap();
    engine
        .place_limit(order(Side::Sell, dec!(49), dec!(100)), 100)
        .unwrap();
    engine
        .place_limit(order(Side::Sell, dec!(49), dec!(100)), 100)
        .unwrap();
    assert_eq!(
        engine.place_limit(order(Side::Sell, dec!(1), dec!(100)), 100),
        Err(ExecutionError::Balance)
    );
}

#[test]
fn stale_gaps_sleep_and_kill_switch_clear_signals_without_liquidating() {
    let dir = TempDir::new().unwrap();
    let mut engine = engine(&dir);
    engine.on_quote(quote(1, 0), 0).unwrap();
    engine.resume(0).unwrap();
    engine
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
        .unwrap();
    assert_eq!(
        engine.place_limit(order(Side::Buy, dec!(1), dec!(100)), 1001),
        Err(ExecutionError::NotReady)
    );
    engine.on_quote(quote(3, 100), 100).unwrap();
    assert!(engine.snapshot().unwrap().paused);
    assert_eq!(engine.snapshot().unwrap().active_orders, 0);
    engine.resume(100).unwrap();
    engine
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 100)
        .unwrap();
    engine.on_quote(quote(4, 200), 200).unwrap();
    engine.on_quote(quote(5, 5000), 5000).unwrap();
    assert!(engine.snapshot().unwrap().paused);
    assert_eq!(engine.snapshot().unwrap().quantity, dec!(1));
    engine.resume(5000).unwrap();
    engine.engage_kill_switch().unwrap();
    engine.on_quote(quote(6, 5100), 5100).unwrap();
    assert_eq!(engine.resume(5100), Err(ExecutionError::NotReady));
    assert_eq!(engine.snapshot().unwrap().quantity, dec!(1));
}

#[test]
fn restart_restores_balances_cancels_unsent_orders_and_requires_activation() {
    let dir = TempDir::new().unwrap();
    let before;
    {
        let mut engine = engine(&dir);
        engine.on_quote(quote(1, 0), 0).unwrap();
        engine.resume(0).unwrap();
        engine
            .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
            .unwrap();
        engine.on_quote(quote(2, 100), 100).unwrap();
        before = engine.snapshot().unwrap();
        engine
            .place_limit(order(Side::Buy, dec!(1), dec!(100)), 100)
            .unwrap();
    }
    let mut engine = engine(&dir);
    assert_eq!(engine.snapshot().unwrap().cash, before.cash);
    assert_eq!(engine.snapshot().unwrap().quantity, before.quantity);
    assert_eq!(engine.snapshot().unwrap().active_orders, 0);
    assert!(engine.snapshot().unwrap().paused);
    assert_eq!(engine.resume(100), Err(ExecutionError::NotReady));
    assert_eq!(engine.on_quote(quote(2, 100), 100).unwrap(), 0);
    assert_eq!(engine.resume(100), Err(ExecutionError::NotReady));
    engine.on_quote(quote(3, 200), 200).unwrap();
    engine.resume(200).unwrap();
    assert_eq!(engine.snapshot().unwrap().fill_count, 1);
}

#[test]
fn cancel_scope_and_expiry_do_not_change_positions() {
    let dir = TempDir::new().unwrap();
    let mut engine = engine(&dir);
    engine.on_quote(quote(1, 0), 0).unwrap();
    engine.resume(0).unwrap();
    let id = engine
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
        .unwrap();
    assert_eq!(
        engine.cancel_owned("someone_else"),
        Err(ExecutionError::Transition)
    );
    engine.cancel_owned(&id).unwrap();
    assert_eq!(engine.cancel_owned(&id), Err(ExecutionError::Transition));
    engine.on_quote(quote(2, 100), 100).unwrap();
    assert_eq!(engine.snapshot().unwrap().quantity, Decimal::ZERO);
}

#[test]
fn invalid_config_cannot_reset_persisted_cash() {
    let dir = TempDir::new().unwrap();
    drop(engine(&dir));
    let mut cfg = config();
    cfg.initial_cash = dec!(100000);
    let journal = Journal::open(dir.path().join("execution.sqlite3")).unwrap();
    assert!(matches!(
        PaperEngine::open(journal, cfg, ExecutionMode::Paper),
        Err(ExecutionError::InvalidInput)
    ));
}

#[test]
fn rate_window_persists_across_cancellation() {
    let dir = TempDir::new().unwrap();
    let mut cfg = config();
    cfg.limits.max_orders_per_minute = 1;
    let mut engine = PaperEngine::open(
        Journal::open(dir.path().join("execution.sqlite3")).unwrap(),
        cfg,
        ExecutionMode::Paper,
    )
    .unwrap();
    engine.on_quote(quote(1, 0), 0).unwrap();
    engine.resume(0).unwrap();
    let id = engine
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
        .unwrap();
    engine.cancel_owned(&id).unwrap();
    assert_eq!(
        engine.place_limit(order(Side::Buy, dec!(1), dec!(100)), 0),
        Err(ExecutionError::Risk)
    );
}

#[test]
fn damaged_ledger_is_not_recreated_and_missing_balances_are_not_reset() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("execution.sqlite3");
    {
        let mut runtime = engine(&dir);
        runtime.on_quote(quote(1, 0), 0).unwrap();
        runtime.resume(0).unwrap();
        runtime
            .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
            .unwrap();
        runtime.on_quote(quote(2, 100), 100).unwrap();
    }
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute("DELETE FROM paper_balance", []).unwrap();
    drop(db);
    let ledger = Journal::open(&path).unwrap();
    assert!(matches!(
        PaperEngine::open(ledger, config(), ExecutionMode::Paper),
        Err(ExecutionError::Schema)
    ));
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute("DROP TABLE paper_fills", []).unwrap();
    drop(db);
    assert!(matches!(Journal::open(&path), Err(ExecutionError::Schema)));
    let db = rusqlite::Connection::open(&path).unwrap();
    let count: i64 = db
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE name='paper_fills'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn adverse_slippage_cannot_fill_past_limit_and_sell_proceeds_account_exactly() {
    let dir = TempDir::new().unwrap();
    let mut cfg = config();
    cfg.slippage_bps = dec!(10);
    let mut runtime = PaperEngine::open(
        Journal::open(dir.path().join("execution.sqlite3")).unwrap(),
        cfg,
        ExecutionMode::Paper,
    )
    .unwrap();
    runtime.on_quote(quote(1, 0), 0).unwrap();
    runtime.resume(0).unwrap();
    let narrow = runtime
        .place_limit(order(Side::Buy, dec!(1), dec!(100)), 0)
        .unwrap();
    assert_eq!(runtime.on_quote(quote(2, 100), 100).unwrap(), 0);
    runtime.cancel_owned(&narrow).unwrap();
    runtime
        .place_limit(order(Side::Buy, dec!(1), dec!(101)), 100)
        .unwrap();
    assert_eq!(runtime.on_quote(quote(3, 200), 200).unwrap(), 1);
    assert_eq!(runtime.snapshot().unwrap().cash, dec!(9899.7999));
    runtime
        .place_limit(order(Side::Sell, dec!(1), dec!(99)), 200)
        .unwrap();
    assert_eq!(runtime.on_quote(quote(4, 300), 300).unwrap(), 1);
    // Bid 99.99 minus 10bps -> 99.89001, floored to the 0.01 tick -> 99.89.
    assert_eq!(runtime.snapshot().unwrap().cash, dec!(9999.59001));
    assert_eq!(runtime.snapshot().unwrap().quantity, Decimal::ZERO);
    assert_eq!(runtime.snapshot().unwrap().fees, dec!(0.19999));
}
