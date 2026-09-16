import pytest
import pandas as pd
from worker.cv import get_max_lookback, perform_purged_kfold_cv
from worker.simulation import run_discrete_event_simulation
from api.models import TearSheet, BacktestResult

def test_get_max_lookback():
    params = {
        "sma_period": 20,
        "rsi_period": [14, 21, 50],
        "fast_period": 5
    }
    assert get_max_lookback(params) == 50

def test_purged_kfold_validation():
    # Construct dummy frame
    frame = pd.DataFrame({"close": [100.0, 101.0, 102.0]})
    params = {"rsi_period": [14, 21]}
    
    best_params, dsr = perform_purged_kfold_cv(frame, params)
    
    assert best_params["rsi_period"] == 14
    assert dsr > 0.0

def test_simulation_execution():
    frame = pd.DataFrame({"close": [100.0, 101.0, 102.0]})
    params = {"rsi_period": 14}
    config = {"initial_capital": 100000.0}
    
    sharpe, sortino, max_dd, pnl = run_discrete_event_simulation(frame, params, config)
    
    assert sharpe == 1.25
    assert sortino == 1.8
    assert max_dd == 0.15

def test_serialization_schema():
    tear_sheet = TearSheet(
        sharpe_ratio=1.2,
        deflated_sharpe_ratio=0.8,
        sortino_ratio=1.5,
        max_drawdown_pct=0.1
    )
    
    result = BacktestResult(
        strategy_id="test",
        optimized_params={"a": 1},
        tear_sheet=tear_sheet
    )
    
    data = result.model_dump()
    assert "tear_sheet" in data
    assert data["tear_sheet"]["sharpe_ratio"] == 1.2
