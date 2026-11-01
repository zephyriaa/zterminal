import os
import sys
import unittest

# Ensure quant-engine directory is on sys.path
ENGINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

from api.queue import JobQueueManager
from worker.limits import ExecutionLimiter, ResourceLimitExceeded
from worker.engine import execute_quant_backtest


SAMPLE_STRATEGY = """
def strategy(data, params):
    fast = params.get("fast", 5)
    slow = params.get("slow", 10)
    fast_ma = data["close"].rolling(fast).mean()
    slow_ma = data["close"].rolling(slow).mean()
    entries = (fast_ma > slow_ma) & (fast_ma.shift(1) <= slow_ma.shift(1))
    exits = (fast_ma < slow_ma) & (fast_ma.shift(1) >= slow_ma.shift(1))
    return {"entries": entries, "exits": exits}
"""


class TestQuantWorker(unittest.TestCase):
    def test_signals_execute_on_next_open_and_change_results(self):
        bars = [{"t": 1740000000000 + i * 300000, "o": price, "h": price,
                 "l": price, "c": price, "v": 500} for i, price in enumerate([10, 20, 30, 40, 50])]
        config = dict(initial_capital=100, fee_bps=0, slippage_bps=0, quantity_step=1)
        source = 'def strategy(data, params):\n return {"entries": data.close == 10, "exits": data.close == 30}'
        result = execute_quant_backtest(source, bars, config, {}, ExecutionLimiter())
        self.assertEqual(result['trades'][0]['entryPrice'], 20)
        self.assertEqual(result['trades'][0]['exitPrice'], 40)
        self.assertEqual(result['metrics']['finalEquity']['value'], 200)
        flat = execute_quant_backtest(source.replace('== 10', '== 0'), bars, config, {}, ExecutionLimiter())
        self.assertEqual(flat['metrics']['finalEquity']['value'], 100)

    def test_rejects_missing_prices_and_misaligned_signals(self):
        with self.assertRaises(ValueError):
            execute_quant_backtest(SAMPLE_STRATEGY, [{'c': 10}], {}, {}, ExecutionLimiter())
        bars = [dict(t=1740000000000, o=10, h=10, l=10, c=10, v=1)]
        with self.assertRaises(ValueError):
            execute_quant_backtest('def strategy(data, params):\n return {"entries": [True, False]}', bars, {}, {}, ExecutionLimiter())

    def test_queue_enqueue_and_cancel(self):
        queue = JobQueueManager()
        job_id = queue.enqueue({"workspace_id": "test_ws", "source": "def test(): pass"})
        self.assertIsNotNone(job_id)

        job = queue.get_job(job_id)
        self.assertEqual(job["status"], "QUEUED")

        cancelled = queue.cancel_job(job_id)
        self.assertTrue(cancelled)

        job_after = queue.get_job(job_id)
        self.assertEqual(job_after["status"], "CANCELLED")

    def test_execution_limiter_timeout(self):
        limiter = ExecutionLimiter(max_wall_seconds=0)
        with self.assertRaises(ResourceLimitExceeded):
            limiter.check()

    def test_quant_backtest_execution(self):
        bars = [
            {"t": 1740000000000 + i * 300000, "o": 100 + i * 0.1, "h": 102 + i * 0.1, "l": 99 + i * 0.1, "c": 101 + i * 0.1, "v": 500}
            for i in range(50)
        ]
        limiter = ExecutionLimiter(max_wall_seconds=60)
        config = {"initial_capital": 10000.0, "fee_bps": 2.0, "slippage_bps": 1.0}
        params = {"fast": 3, "slow": 6}

        result = execute_quant_backtest(SAMPLE_STRATEGY, bars, config, params, limiter)
        self.assertIn("metrics", result)
        self.assertIn("equity_curve", result)
        self.assertIn("result_id", result)
        self.assertEqual(result["bars_processed"], 50)

    def test_worker_process_job(self):
        from worker.worker import QuantWorker
        queue = JobQueueManager()
        bars = [
            {"t": 1740000000000 + i * 300000, "o": 100 + i * 0.1, "h": 102 + i * 0.1, "l": 99 + i * 0.1, "c": 101 + i * 0.1, "v": 500}
            for i in range(20)
        ]
        job_id = queue.enqueue({
            "workspace_id": "ws-e2e",
            "source": SAMPLE_STRATEGY,
            "bars": bars,
            "config": {"initial_capital": 50000.0},
            "params": {"fast": 2, "slow": 5},
        })

        worker = QuantWorker(queue)
        job = queue.get_job(job_id)
        self.assertIsNotNone(job)
        worker.process_job(job)

        completed = queue.get_job(job_id)
        self.assertEqual(completed["status"], "SUCCEEDED")
        self.assertEqual(completed["stage"], "complete")
        self.assertIsNotNone(completed["result"])
        self.assertIn("metrics", completed["result"])


if __name__ == "__main__":
    unittest.main()
