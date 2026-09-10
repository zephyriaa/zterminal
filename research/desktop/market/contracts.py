"""Pure Phase-0 contracts; importing this module never imports NautilusTrader."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from pathlib import PurePosixPath
from typing import Iterable, TypeVar

MICROSTRUCTURE_CONTRACT_VERSION = 1
EVENT_DATASET_VERSION = 2


class ResearchMode(StrEnum):
    """The two explicit research data paths supported by the contract."""

    CANDLE = "candle"
    EVENT = "event"


class TradeGranularity(StrEnum):
    INDIVIDUAL = "individual"
    AGGREGATE = "aggregate"
    UNKNOWN = "unknown"


class IntegrityState(StrEnum):
    VERIFIED = "verified"
    GAP = "gap"
    CORRUPT = "corrupt"
    INCOMPLETE = "incomplete"
    UNAVAILABLE = "unavailable"


class FreshnessState(StrEnum):
    LIVE = "live"
    HISTORICAL = "historical"
    DELAYED = "delayed"
    STALE = "stale"


def _positive_decimal(value: str, name: str) -> None:
    try:
        parsed = Decimal(value)
    except (InvalidOperation, TypeError) as error:
        raise ValueError(f"{name} must be a decimal string") from error
    if not parsed.is_finite() or parsed <= 0:
        raise ValueError(f"{name} must be finite and positive")


def _sha256(value: str, name: str) -> None:
    if len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
        raise ValueError(f"{name} must be a lowercase SHA-256 hex digest")


@dataclass(frozen=True)
class InstrumentUnits:
    """A revisioned unit contract beside the native Nautilus instrument."""

    instrument_id: str
    venue: str
    product: str
    price_increment: str
    size_increment: str
    price_currency: str
    size_unit: str
    settlement_currency: str
    contract_multiplier: str
    multiplier_unit: str
    valid_from_ns: int
    observed_at_ns: int
    revision: int = 1
    valid_to_ns: int | None = None

    def __post_init__(self) -> None:
        if not self.instrument_id or not self.venue or not self.product:
            raise ValueError("instrument identity is required")
        for name in ("price_currency", "size_unit", "settlement_currency", "multiplier_unit"):
            if not getattr(self, name):
                raise ValueError(f"{name} is required")
        _positive_decimal(self.price_increment, "price_increment")
        _positive_decimal(self.size_increment, "size_increment")
        _positive_decimal(self.contract_multiplier, "contract_multiplier")
        if self.revision < 1 or min(self.valid_from_ns, self.observed_at_ns) < 0:
            raise ValueError("instrument revision and timestamps are invalid")
        if self.valid_to_ns is not None and self.valid_to_ns <= self.valid_from_ns:
            raise ValueError("valid_to_ns must be later than valid_from_ns")


@dataclass(frozen=True, order=True)
class AvailabilityOrder:
    """Stable replay key based on when data became locally usable."""

    available_at_ns: int
    ingress_ordinal: int
    stream_id: str
    batch_index: int = 0

    def __post_init__(self) -> None:
        if min(self.available_at_ns, self.ingress_ordinal, self.batch_index) < 0 or not self.stream_id:
            raise ValueError("availability ordering fields are invalid")


@dataclass(frozen=True)
class IngressProvenance:
    """Metadata Nautilus events do not universally retain after normalization."""

    stream_id: str
    subscription_generation: int
    ingress_ordinal: int
    received_at_ns: int
    monotonic_received_ns: int
    available_at_ns: int
    adapter_version: str
    native_event_id: str | None = None
    first_update_id: int | None = None
    final_update_id: int | None = None
    previous_update_id: int | None = None
    checksum: str | None = None
    trade_granularity: TradeGranularity = TradeGranularity.UNKNOWN
    batch_index: int = 0

    def __post_init__(self) -> None:
        if not self.stream_id or not self.adapter_version:
            raise ValueError("stream_id and adapter_version are required")
        if min(
            self.subscription_generation,
            self.ingress_ordinal,
            self.received_at_ns,
            self.monotonic_received_ns,
            self.available_at_ns,
            self.batch_index,
        ) < 0:
            raise ValueError("provenance counters and timestamps cannot be negative")
        for value in (self.first_update_id, self.final_update_id, self.previous_update_id):
            if value is not None and value < 0:
                raise ValueError("native update identifiers cannot be negative")
        if (
            self.first_update_id is not None
            and self.final_update_id is not None
            and self.first_update_id > self.final_update_id
        ):
            raise ValueError("first_update_id cannot exceed final_update_id")

    @property
    def availability_order(self) -> AvailabilityOrder:
        return AvailabilityOrder(
            self.available_at_ns,
            self.ingress_ordinal,
            self.stream_id,
            self.batch_index,
        )


@dataclass(frozen=True)
class FeedQualityEpoch:
    """A gap begins a new epoch; state cannot flow across epoch boundaries."""

    stream_id: str
    epoch: int
    integrity: IntegrityState
    freshness: FreshnessState
    effective_at_ns: int
    observed_at_ns: int
    reason: str | None = None
    last_accepted_sequence: int | None = None

    def __post_init__(self) -> None:
        if not self.stream_id or self.epoch < 0 or min(self.effective_at_ns, self.observed_at_ns) < 0:
            raise ValueError("feed-quality identity and timestamps are invalid")
        if self.last_accepted_sequence is not None and self.last_accepted_sequence < 0:
            raise ValueError("last_accepted_sequence cannot be negative")
        if self.integrity is not IntegrityState.VERIFIED and not self.reason:
            raise ValueError("non-verified quality requires a reason")


@dataclass(frozen=True)
class DatasetFragment:
    path: str
    data_type: str
    start_available_ns: int
    end_available_ns: int
    rows: int
    sha256: str
    compression: str = "zstd"

    def __post_init__(self) -> None:
        path = PurePosixPath(self.path)
        if path.is_absolute() or ".." in path.parts or not self.data_type:
            raise ValueError("fragment path must be a safe catalog-relative path")
        if self.start_available_ns < 0 or self.end_available_ns < self.start_available_ns or self.rows < 1:
            raise ValueError("fragment range and row count are invalid")
        _sha256(self.sha256, "fragment sha256")
        if self.compression != "zstd":
            raise ValueError("Phase-0 event fragments require Zstd")


@dataclass(frozen=True)
class EventDatasetManifest:
    """Immutable event dataset identity; it references data instead of embedding it."""

    dataset_id: str
    created_at_ns: int
    instruments: tuple[str, ...]
    fragments: tuple[DatasetFragment, ...]
    manifest_sha256: str
    integrity: IntegrityState
    timestamp_provenance: str
    ordering: str = "available_at_ns,ingress_ordinal,stream_id,batch_index"
    contract_version: int = MICROSTRUCTURE_CONTRACT_VERSION
    version: int = EVENT_DATASET_VERSION
    gaps: tuple[tuple[int, int, str], ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.version != EVENT_DATASET_VERSION or self.contract_version != MICROSTRUCTURE_CONTRACT_VERSION:
            raise ValueError("unsupported event dataset contract")
        if not self.dataset_id or self.created_at_ns < 0 or not self.instruments or not self.fragments:
            raise ValueError("dataset identity, instruments and fragments are required")
        if len(set(self.instruments)) != len(self.instruments):
            raise ValueError("dataset instruments must be unique")
        _sha256(self.manifest_sha256, "manifest_sha256")
        if self.timestamp_provenance not in ("exchange_and_receive", "exchange_time_only"):
            raise ValueError("unsupported timestamp provenance")
        if self.ordering != "available_at_ns,ingress_ordinal,stream_id,batch_index":
            raise ValueError("unsupported event ordering")
        if self.integrity is IntegrityState.VERIFIED and self.gaps:
            raise ValueError("a verified dataset cannot declare gaps")
        for start, end, reason in self.gaps:
            if start < 0 or end <= start or not reason:
                raise ValueError("invalid dataset gap")


@dataclass(frozen=True)
class ResearchDataRequirements:
    mode: ResearchMode
    data_types: tuple[str, ...]
    require_verified: bool = True

    def __post_init__(self) -> None:
        if self.mode is ResearchMode.EVENT and not self.data_types:
            raise ValueError("event research must declare required data types")


T = TypeVar("T")


def order_by_availability(items: Iterable[T], provenance=lambda item: item.provenance) -> list[T]:
    """Return a stable deterministic replay order without changing source timestamps."""

    return sorted(items, key=lambda item: provenance(item).availability_order)
