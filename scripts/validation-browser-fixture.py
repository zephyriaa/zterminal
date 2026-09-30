"""Seed only a temporary Helper archive with explicitly simulated closed candles."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "research" / "desktop"))
from archive import Archive
from engine import execute
from test_engine import fixture
from test_validation_engine import PERIODIC

root = Path(sys.argv[1])
units = json.loads(sys.argv[2])
request = fixture(PERIODIC, prices=[100, 100, 100.5, 101] * 40,
                  multiplier=units["multiplier"], quantityStep=units["quantityStep"], allocation=1)
request["name"] = "SIMULATED validation browser fixture"
request["params"] = {"x": 2, "y": 2}
request["dataset"]["simulated"] = True
archive = Archive(root / "research.sqlite3")
# This retained genuine run seeds the exact cached dataset. The browser must
# submit its own backtest to the authenticated Helper before validation.
archive.save_result(execute(request))
(root / "browser-fixture.json").write_text(json.dumps(request), encoding="utf-8")
