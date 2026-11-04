import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple

def get_max_lookback(params: Dict[str, Any]) -> int:
    """Extracts max lookback window dynamically from strategy inputs."""
    max_lookback = 0
    for k, v in params.items():
        if isinstance(v, int) and "period" in k.lower():
            max_lookback = max(max_lookback, v)
        elif isinstance(v, list) or isinstance(v, np.ndarray):
            for val in v:
                if isinstance(val, int) and "period" in k.lower():
                    max_lookback = max(max_lookback, val)
    return max_lookback if max_lookback > 0 else 100 # default purge period

def perform_purged_kfold_cv(
    frame: pd.DataFrame, 
    params: Dict[str, Any], 
    k_folds: int = 5
) -> Tuple[Dict[str, Any], float]:
    """Unavailable until real strategy trials, purge and embargo are implemented."""
    raise NotImplementedError("Purged cross-validation and deflated Sharpe are unavailable")
