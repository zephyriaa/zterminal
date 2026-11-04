from typing import Dict, Any, Tuple
import pandas as pd


def run_discrete_event_simulation(
    frame: pd.DataFrame,
    params: Dict[str, Any],
    config: Dict[str, Any]
) -> Tuple[float, float, float, float]:
    """Tick and queue-position simulation requires a verified execution adapter."""
    raise NotImplementedError("Discrete-event simulation is unavailable; use the bar simulator explicitly")
