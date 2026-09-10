"""Optional NautilusTrader 1.231 compatibility boundary for event research."""

from __future__ import annotations

from typing import Any

from .contracts import IngressProvenance, TradeGranularity

SUPPORTED_NAUTILUS_VERSION = "1.231.0"
_INGRESS_PROVENANCE_DATA: type | None = None


def require_supported_nautilus() -> None:
    from importlib.metadata import version

    installed = version("nautilus_trader")
    if installed != SUPPORTED_NAUTILUS_VERSION:
        raise RuntimeError(
            f"Event research requires nautilus_trader {SUPPORTED_NAUTILUS_VERSION}; found {installed}"
        )


def validate_atomic_book_snapshot(batch: Any) -> None:
    """Validate the native snapshot batch before any downstream state is published."""

    from nautilus_trader.model.enums import BookAction, RecordFlag

    deltas = list(batch.deltas)
    if not deltas or deltas[0].action != BookAction.CLEAR:
        raise ValueError("book snapshot must begin with CLEAR")
    if any(delta.instrument_id != batch.instrument_id for delta in deltas):
        raise ValueError("book snapshot contains another instrument")
    last_flag = int(RecordFlag.F_LAST.value)
    snapshot_flag = int(RecordFlag.F_SNAPSHOT.value)
    if any(int(delta.flags) & last_flag for delta in deltas[:-1]):
        raise ValueError("F_LAST may appear only on the final snapshot delta")
    if int(deltas[-1].flags) & (last_flag | snapshot_flag) != (last_flag | snapshot_flag):
        raise ValueError("final snapshot delta must carry F_SNAPSHOT and F_LAST")
    if not batch.is_snapshot:
        raise ValueError("native batch does not report snapshot semantics")


def deserialize_native_cython(data_cls: type, table: Any) -> list[Any]:
    """Return one wrapper family across the 1.231 Rust/Cython Arrow boundary."""

    from nautilus_trader.serialization.arrow.serializer import ArrowSerializer

    restored = ArrowSerializer.deserialize(data_cls, table)
    return [item if isinstance(item, data_cls) else data_cls.from_pyo3(item) for item in restored]


def register_ingress_provenance_arrow() -> type:
    """Register the ZTerminal sidecar while leaving native events on native schemas."""

    global _INGRESS_PROVENANCE_DATA
    if _INGRESS_PROVENANCE_DATA is not None:
        return _INGRESS_PROVENANCE_DATA

    import pyarrow as pa
    from nautilus_trader.core.data import Data
    from nautilus_trader.serialization.arrow.serializer import (
        make_dict_deserializer,
        make_dict_serializer,
        register_arrow,
    )

    class IngressProvenanceData(Data):
        def __init__(self, **values: Any) -> None:
            self.values = values

        @property
        def ts_event(self) -> int:
            return int(self.values["available_at_ns"])

        @property
        def ts_init(self) -> int:
            return int(self.values["available_at_ns"])

        @staticmethod
        def to_dict(value: "IngressProvenanceData") -> dict[str, Any]:
            return dict(value.values)

        @staticmethod
        def from_dict(values: dict[str, Any]) -> "IngressProvenanceData":
            return IngressProvenanceData(**values)

        @classmethod
        def from_contract(cls, value: IngressProvenance) -> "IngressProvenanceData":
            return cls(
                stream_id=value.stream_id,
                subscription_generation=value.subscription_generation,
                ingress_ordinal=value.ingress_ordinal,
                received_at_ns=value.received_at_ns,
                monotonic_received_ns=value.monotonic_received_ns,
                available_at_ns=value.available_at_ns,
                adapter_version=value.adapter_version,
                native_event_id=value.native_event_id,
                first_update_id=value.first_update_id,
                final_update_id=value.final_update_id,
                previous_update_id=value.previous_update_id,
                checksum=value.checksum,
                trade_granularity=value.trade_granularity.value,
                batch_index=value.batch_index,
            )

        def to_contract(self) -> IngressProvenance:
            return IngressProvenance(
                **{**self.values, "trade_granularity": TradeGranularity(self.values["trade_granularity"])}
            )

    schema = pa.schema(
        [
            pa.field("stream_id", pa.string(), False),
            pa.field("subscription_generation", pa.uint64(), False),
            pa.field("ingress_ordinal", pa.uint64(), False),
            pa.field("received_at_ns", pa.uint64(), False),
            pa.field("monotonic_received_ns", pa.uint64(), False),
            pa.field("available_at_ns", pa.uint64(), False),
            pa.field("adapter_version", pa.string(), False),
            pa.field("native_event_id", pa.string(), True),
            pa.field("first_update_id", pa.uint64(), True),
            pa.field("final_update_id", pa.uint64(), True),
            pa.field("previous_update_id", pa.uint64(), True),
            pa.field("checksum", pa.string(), True),
            pa.field("trade_granularity", pa.string(), False),
            pa.field("batch_index", pa.uint32(), False),
        ],
        metadata={b"type": b"ZTerminalIngressProvenance", b"contract_version": b"1"},
    )
    register_arrow(
        IngressProvenanceData,
        schema,
        encoder=make_dict_serializer(schema),
        decoder=make_dict_deserializer(IngressProvenanceData),
    )
    _INGRESS_PROVENANCE_DATA = IngressProvenanceData
    return IngressProvenanceData
