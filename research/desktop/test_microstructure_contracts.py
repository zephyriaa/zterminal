import json
from pathlib import Path
import tempfile
import unittest

from market.contracts import (
    DatasetFragment, EventDatasetManifest, IngressProvenance, InstrumentUnits,
    IntegrityState, ResearchDataRequirements, ResearchMode, TradeGranularity,
    order_by_availability,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "packages" / "contract-fixtures" / "microstructure-phase0-v1.json"


def fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def provenance(raw):
    return IngressProvenance(
        stream_id=raw["streamId"], subscription_generation=int(raw["subscriptionGeneration"]),
        ingress_ordinal=int(raw["ingressOrdinal"]), received_at_ns=int(raw["receivedAtNs"]),
        monotonic_received_ns=int(raw["monotonicReceivedNs"]), available_at_ns=int(raw["availableAtNs"]),
        adapter_version=raw["adapterVersion"], native_event_id=raw.get("nativeEventId"),
        first_update_id=int(raw["firstUpdateId"]) if raw.get("firstUpdateId") is not None else None,
        final_update_id=int(raw["finalUpdateId"]) if raw.get("finalUpdateId") is not None else None,
        previous_update_id=int(raw["previousUpdateId"]) if raw.get("previousUpdateId") is not None else None,
        checksum=raw.get("checksum"),
        trade_granularity=TradeGranularity(raw["tradeGranularity"]), batch_index=raw["batchIndex"],
    )


class PhaseZeroContractTests(unittest.TestCase):
    def test_instrument_units_are_exact_decimal_strings(self):
        raw = fixture()["instrument"]
        units = InstrumentUnits(
            instrument_id=raw["instrumentId"], venue=raw["venue"], product=raw["product"],
            price_increment=raw["priceIncrement"], size_increment=raw["sizeIncrement"],
            price_currency=raw["priceCurrency"], size_unit=raw["sizeUnit"],
            settlement_currency=raw["settlementCurrency"], contract_multiplier=raw["contractMultiplier"],
            multiplier_unit=raw["multiplierUnit"], valid_from_ns=int(raw["validFromNs"]),
            observed_at_ns=int(raw["observedAtNs"]),
        )
        self.assertEqual(units.price_increment, "0.10")
        with self.assertRaisesRegex(ValueError, "positive"):
            InstrumentUnits(**{**units.__dict__, "price_increment": "0"})

    def test_equal_availability_times_use_recorded_ingress_order(self):
        class Item:
            def __init__(self, raw):
                self.label, self.provenance = raw["label"], provenance(raw)

        data = fixture()
        ordered = order_by_availability(Item(raw) for raw in data["provenance"])
        self.assertEqual([item.label for item in ordered], data["expectedReplayOrder"])

    def test_event_mode_requires_explicit_data_types(self):
        with self.assertRaisesRegex(ValueError, "required data types"):
            ResearchDataRequirements(ResearchMode.EVENT, ())
        self.assertEqual(ResearchDataRequirements(ResearchMode.CANDLE, ()).mode, ResearchMode.CANDLE)

    def test_verified_manifest_cannot_contain_a_gap(self):
        fragment = DatasetFragment("trades/day.parquet", "TradeTick", 1, 2, 1, "a" * 64)
        with self.assertRaisesRegex(ValueError, "cannot declare gaps"):
            EventDatasetManifest(
                "dataset", 3, ("BTCUSDT-PERP.BINANCE",), (fragment,), "b" * 64,
                IntegrityState.VERIFIED, "exchange_and_receive", gaps=((1, 2, "gap"),),
            )


class NautilusCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            from market.nautilus_compat import require_supported_nautilus
            require_supported_nautilus()
        except (ImportError, RuntimeError) as error:
            raise unittest.SkipTest(str(error)) from error

    def test_native_trade_arrow_round_trip(self):
        from market.nautilus_compat import deserialize_native_cython
        from nautilus_trader.model.data import TradeTick
        from nautilus_trader.model.enums import AggressorSide
        from nautilus_trader.model.identifiers import InstrumentId, TradeId
        from nautilus_trader.model.objects import Price, Quantity
        from nautilus_trader.serialization.arrow.serializer import ArrowSerializer

        trade = TradeTick(
            InstrumentId.from_str("BTCUSDT-PERP.BINANCE"), Price.from_str("65000.10"),
            Quantity.from_str("0.125"), AggressorSide.BUYER, TradeId("aggregate-42"),
            1700000000000000000, 1700000000000000100,
        )
        table = ArrowSerializer.serialize_batch([trade], TradeTick)
        restored = deserialize_native_cython(TradeTick, table)[0]
        self.assertEqual(TradeTick.to_dict(restored), TradeTick.to_dict(trade))

    def test_binance_futures_subscription_is_aggregate_trade_granularity(self):
        import inspect
        from nautilus_trader.adapters.binance.data import BinanceCommonDataClient

        source = inspect.getsource(BinanceCommonDataClient._subscribe_trade_ticks)
        self.assertIn("is_futures", source)
        self.assertIn("subscribe_agg_trades", source)

    def test_custom_provenance_arrow_round_trip(self):
        from market.nautilus_compat import register_ingress_provenance_arrow
        from nautilus_trader.serialization.arrow.serializer import ArrowSerializer

        data_type = register_ingress_provenance_arrow()
        source = provenance(fixture()["provenance"][0])
        table = ArrowSerializer.serialize_batch([data_type.from_contract(source)], data_type)
        self.assertEqual(ArrowSerializer.deserialize(data_type, table)[0].to_contract(), source)

    def test_atomic_snapshot_survives_native_arrow_serialization(self):
        from market.nautilus_compat import deserialize_native_cython, validate_atomic_book_snapshot
        from nautilus_trader.model.data import BookOrder, OrderBookDelta, OrderBookDeltas
        from nautilus_trader.model.enums import BookAction, OrderSide, RecordFlag
        from nautilus_trader.model.identifiers import InstrumentId
        from nautilus_trader.model.objects import Price, Quantity
        from nautilus_trader.serialization.arrow.serializer import ArrowSerializer

        instrument = InstrumentId.from_str("BTCUSDT-PERP.BINANCE")
        end_flags = int(RecordFlag.F_SNAPSHOT.value) | int(RecordFlag.F_LAST.value)
        deltas = [
            OrderBookDelta(instrument, BookAction.CLEAR, None, 0, 100, 1, 2),
            OrderBookDelta(instrument, BookAction.ADD, BookOrder(OrderSide.BUY, Price.from_str("65000.0"), Quantity.from_str("1.0"), 1), 0, 100, 1, 2),
            OrderBookDelta(instrument, BookAction.ADD, BookOrder(OrderSide.SELL, Price.from_str("65000.1"), Quantity.from_str("2.0"), 2), end_flags, 100, 1, 2),
        ]
        batch = OrderBookDeltas(instrument, deltas)
        validate_atomic_book_snapshot(batch)
        table = ArrowSerializer.serialize_batch([batch], OrderBookDeltas)
        restored = OrderBookDeltas.batch(deserialize_native_cython(OrderBookDelta, table))[0]
        validate_atomic_book_snapshot(restored)
        original_rows = batch.deltas
        restored_rows = restored.deltas
        self.assertEqual(
            [(row.action, row.flags, row.sequence, row.ts_event, row.ts_init) for row in restored_rows],
            [(row.action, row.flags, row.sequence, row.ts_event, row.ts_init) for row in original_rows],
        )
        self.assertEqual(
            [(str(row.order.price), str(row.order.size)) for row in restored_rows[1:]],
            [(str(row.order.price), str(row.order.size)) for row in original_rows[1:]],
        )

    def test_custom_parquet_round_trip_uses_zstd(self):
        import pyarrow.parquet as pq
        from market.nautilus_compat import register_ingress_provenance_arrow
        from nautilus_trader.serialization.arrow.serializer import ArrowSerializer

        data_type = register_ingress_provenance_arrow()
        source = data_type.from_contract(provenance(fixture()["provenance"][1]))
        table = ArrowSerializer.serialize_batch([source], data_type)
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "provenance.parquet"
            pq.write_table(table, path, compression="zstd")
            self.assertEqual(pq.ParquetFile(path).metadata.row_group(0).column(0).compression, "ZSTD")
            restored = ArrowSerializer.deserialize(data_type, pq.read_table(path))[0]
        self.assertEqual(restored.to_contract(), source.to_contract())

    def test_native_parquet_round_trip_uses_zstd(self):
        import pyarrow.parquet as pq
        from market.nautilus_compat import deserialize_native_cython
        from nautilus_trader.model.data import TradeTick
        from nautilus_trader.model.enums import AggressorSide
        from nautilus_trader.model.identifiers import InstrumentId, TradeId
        from nautilus_trader.model.objects import Price, Quantity
        from nautilus_trader.serialization.arrow.serializer import ArrowSerializer

        source = TradeTick(
            InstrumentId.from_str("BTCUSDT-PERP.BINANCE"), Price.from_str("65000.10"),
            Quantity.from_str("0.125"), AggressorSide.BUYER, TradeId("aggregate-43"), 10, 11,
        )
        table = ArrowSerializer.serialize_batch([source], TradeTick)
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "trades.parquet"
            pq.write_table(table, path, compression="zstd")
            self.assertEqual(pq.ParquetFile(path).metadata.row_group(0).column(0).compression, "ZSTD")
            restored = deserialize_native_cython(TradeTick, pq.read_table(path))[0]
        self.assertEqual(TradeTick.to_dict(restored), TradeTick.to_dict(source))


if __name__ == "__main__":
    unittest.main()
