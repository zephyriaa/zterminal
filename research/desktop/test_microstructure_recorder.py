import json
import importlib.util
from pathlib import Path
import tempfile
import unittest

from market.contracts import FeedQualityEpoch, FreshnessState, IngressProvenance, IntegrityState, TradeGranularity

try:
    from market.recorder import LocalEventRecorder, RecordedEvent, RecorderError, RecorderOverflow, RecorderState
except RuntimeError:
    raise


def provenance(ordinal: int, available: int = 100) -> IngressProvenance:
    return IngressProvenance(
        stream_id="binance-futures:btcusdt@aggTrade", subscription_generation=1, ingress_ordinal=ordinal,
        received_at_ns=available, monotonic_received_ns=available, available_at_ns=available,
        adapter_version="fixture-1", native_event_id=f"aggregate-{ordinal}", trade_granularity=TradeGranularity.AGGREGATE,
    )


def quality(integrity: IntegrityState = IntegrityState.VERIFIED) -> FeedQualityEpoch:
    return FeedQualityEpoch("binance-futures:btcusdt@aggTrade", 1, integrity, FreshnessState.HISTORICAL, 1, 1, None if integrity is IntegrityState.VERIFIED else "fixture gap")


def event(ordinal: int, available: int = 100) -> RecordedEvent:
    return RecordedEvent("BTCUSDT-PERP.BINANCE", "BinanceAggregateTrade", {"a": str(ordinal), "p": "65000.10", "q": "0.125"}, provenance(ordinal, available), quality())


@unittest.skipUnless(importlib.util.find_spec("pyarrow") is not None, "optional event PyArrow environment is not installed")
class RecorderTests(unittest.TestCase):
    def test_journals_then_commits_zstd_manifest_and_cursor(self):
        import pyarrow.parquet as pq
        with tempfile.TemporaryDirectory() as temp:
            recorder = LocalEventRecorder(temp, "fixture", max_queue_events=2)
            recorder.accept(event(7, 100))
            recorder.accept(event(8, 100))
            self.assertEqual(recorder.durable_cursor, 8)
            manifest = recorder.commit("fixture-dataset")
            self.assertEqual(manifest.integrity, IntegrityState.VERIFIED)
            self.assertEqual(recorder.state, RecorderState.CLOSED)
            fragment = Path(temp) / manifest.fragments[0].path
            self.assertEqual(pq.ParquetFile(fragment).metadata.row_group(0).column(0).compression, "ZSTD")
            rows = pq.read_table(fragment).to_pylist()
            self.assertEqual([json.loads(row["payload_json"])["a"] for row in rows], ["7", "8"])
            recovery = LocalEventRecorder.recover(temp, "fixture")
            self.assertEqual(recovery.durable_cursor, 8)
            self.assertEqual(len(recovery.manifests), 1)

    def test_overflow_fails_closed_without_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            recorder = LocalEventRecorder(temp, "overflow", max_queue_events=1)
            recorder.accept(event(1))
            with self.assertRaises(RecorderOverflow):
                recorder.accept(event(2))
            self.assertEqual(recorder.state, RecorderState.OVERFLOW)
            with self.assertRaises(RecorderError):
                recorder.commit("cannot-certify")
            self.assertFalse(list((Path(temp) / "manifests").glob("*.json")))

    def test_non_verified_quality_fails_closed_before_fragment(self):
        with tempfile.TemporaryDirectory() as temp:
            recorder = LocalEventRecorder(temp, "gap")
            bad = RecordedEvent("BTCUSDT-PERP.BINANCE", "BinanceDepth", {"U": "1", "u": "2", "pu": "0"}, provenance(1), quality(IntegrityState.GAP))
            with self.assertRaises(RecorderError):
                recorder.accept(bad)
            self.assertEqual(recorder.state, RecorderState.GAP)
            self.assertFalse(list((Path(temp) / "fragments").rglob("*.parquet")))

    def test_recovery_reports_orphans_and_tampered_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            recorder = LocalEventRecorder(temp, "recovery")
            recorder.accept(event(1))
            recorder.commit("recovery-dataset")
            stage = Path(temp) / "staging" / "recovery-interrupted.parquet.tmp"
            stage.write_bytes(b"partial")
            manifest_path = next((Path(temp) / "manifests").glob("*.json"))
            value = json.loads(manifest_path.read_text(encoding="utf-8"))
            value["datasetId"] = "tampered"
            manifest_path.write_text(json.dumps(value), encoding="utf-8")
            recovered = LocalEventRecorder.recover(temp, "recovery")
            self.assertEqual(recovered.manifests, ())
            self.assertEqual(recovered.invalid_manifests, (manifest_path,))
            self.assertEqual(recovered.orphaned_staging, (stage,))

    def test_native_events_keep_the_nautilus_arrow_schema(self):
        from market.nautilus_compat import deserialize_native_cython, require_supported_nautilus
        from nautilus_trader.model.data import TradeTick
        from nautilus_trader.model.enums import AggressorSide
        from nautilus_trader.model.identifiers import InstrumentId, TradeId
        from nautilus_trader.model.objects import Price, Quantity
        import pyarrow.parquet as pq

        require_supported_nautilus()
        native = TradeTick(
            InstrumentId.from_str("BTCUSDT-PERP.BINANCE"), Price.from_str("65000.10"),
            Quantity.from_str("0.125"), AggressorSide.BUYER, TradeId("aggregate-9"), 100, 101,
        )
        source = RecordedEvent(
            "BTCUSDT-PERP.BINANCE", "TradeTick", {"a": "9"}, provenance(9, 101), quality(), native,
        )
        with tempfile.TemporaryDirectory() as temp:
            recorder = LocalEventRecorder(temp, "native")
            recorder.accept(source)
            manifest = recorder.commit("native-dataset")
            self.assertEqual(manifest.fragments[0].data_type, "TradeTick")
            table = pq.read_table(Path(temp) / manifest.fragments[0].path)
            restored = deserialize_native_cython(TradeTick, table)[0]
        self.assertEqual(TradeTick.to_dict(restored), TradeTick.to_dict(native))


if __name__ == "__main__":
    unittest.main()
