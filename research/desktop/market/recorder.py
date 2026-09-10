"""Local, offline Phase-1 event recorder.

This module owns files only.  It opens no network connection, starts no feed,
and imports PyArrow only when a recorder is constructed.  A future adapter must
validate provider frames and create ``RecordedEvent`` instances before calling
``accept``.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import StrEnum
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Mapping

from .contracts import (
    DatasetFragment,
    EventDatasetManifest,
    FeedQualityEpoch,
    IngressProvenance,
    IntegrityState,
)


class RecorderState(StrEnum):
    ACTIVE = "active"
    GAP = "gap"
    OVERFLOW = "overflow"
    STORAGE_FAILURE = "storage_failure"
    CLOSED = "closed"


class RecorderError(RuntimeError):
    """Base class for recorder failures that prevent certification."""


class RecorderOverflow(RecorderError):
    pass


class RecorderStorageError(RecorderError):
    pass


@dataclass(frozen=True)
class RecordedEvent:
    """A validated source event plus the sidecars needed for replay.

    ``payload`` is the lossless provider-shaped payload prepared by the adapter.
    ``native_event`` is optional during Phase 1; when supplied for every event in
    a fragment, the recorder uses the native Nautilus Arrow schema.
    """

    instrument_id: str
    data_type: str
    payload: Mapping[str, Any]
    provenance: IngressProvenance
    quality: FeedQualityEpoch
    native_event: Any | None = None

    def __post_init__(self) -> None:
        if not self.instrument_id or not self.data_type:
            raise ValueError("recorded event identity is required")
        if self.provenance.stream_id != self.quality.stream_id:
            raise ValueError("event provenance and quality must share a stream")


@dataclass(frozen=True)
class RecorderRecovery:
    manifests: tuple[Path, ...]
    invalid_manifests: tuple[Path, ...]
    orphaned_staging: tuple[Path, ...]
    durable_cursor: int | None


def _canonical_json(value: Any) -> bytes:
    """Stable JSON for local journals and manifest hashes.

    The Phase-0 wire contract keeps decimal and nanosecond values as strings,
    so this deliberately rejects arbitrary Python objects instead of silently
    coercing source data.
    """

    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _fsync(path: Path) -> None:
    # Windows does not permit FlushFileBuffers for a read-only descriptor.
    with path.open("r+b") as source:
        os.fsync(source.fileno())


class LocalEventRecorder:
    """One bounded, single-writer recorder for an explicit local session."""

    def __init__(
        self,
        root: str | Path,
        session_id: str,
        *,
        max_queue_events: int = 10_000,
        timestamp_provenance: str = "exchange_and_receive",
    ) -> None:
        if not session_id or "/" in session_id or "\\" in session_id or session_id in {".", ".."}:
            raise ValueError("session_id must be a single path component")
        if max_queue_events < 1:
            raise ValueError("max_queue_events must be positive")
        if timestamp_provenance not in {"exchange_and_receive", "exchange_time_only"}:
            raise ValueError("unsupported timestamp provenance")
        try:
            import pyarrow as pa  # noqa: F401
            import pyarrow.parquet as pq  # noqa: F401
        except ImportError as error:
            raise RuntimeError("LocalEventRecorder requires the optional event PyArrow environment") from error

        self.root = Path(root).resolve()
        self.session_id = session_id
        self.max_queue_events = max_queue_events
        self.timestamp_provenance = timestamp_provenance
        self.state = RecorderState.ACTIVE
        self._queue: list[RecordedEvent] = []
        self._last_ingress_ordinal = -1
        self._durable_cursor: int | None = None
        self._fragments: list[DatasetFragment] = []
        self._instruments: set[str] = set()
        self._created_at_ns = 0
        self._session = self.root / "sessions" / session_id
        self._journal = self._session / "journal.jsonl"
        self._checkpoint = self._session / "checkpoint.json"
        for directory in (self._session, self.root / "staging", self.root / "fragments", self.root / "manifests"):
            directory.mkdir(parents=True, exist_ok=True)

    @property
    def durable_cursor(self) -> int | None:
        return self._durable_cursor

    def _append_journal(self, entry: Mapping[str, Any]) -> None:
        encoded = _canonical_json(entry) + b"\n"
        try:
            with self._journal.open("ab") as journal:
                journal.write(encoded)
                journal.flush()
                os.fsync(journal.fileno())
        except OSError as error:
            self.state = RecorderState.STORAGE_FAILURE
            raise RecorderStorageError("could not durably append recorder journal") from error

    def _checkpoint_cursor(self, cursor: int) -> None:
        value = {"sessionId": self.session_id, "durableCursor": str(cursor)}
        temporary = self._checkpoint.with_suffix(".tmp")
        try:
            with temporary.open("wb") as target:
                target.write(_canonical_json(value))
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary, self._checkpoint)
            _fsync(self._checkpoint)
        except OSError as error:
            self.state = RecorderState.STORAGE_FAILURE
            raise RecorderStorageError("could not persist recorder cursor") from error
        self._durable_cursor = cursor

    @staticmethod
    def _event_journal_entry(event: RecordedEvent) -> dict[str, Any]:
        provenance = asdict(event.provenance)
        provenance["trade_granularity"] = event.provenance.trade_granularity.value
        quality = asdict(event.quality)
        quality["integrity"] = event.quality.integrity.value
        quality["freshness"] = event.quality.freshness.value
        return {
            "kind": "event",
            "instrumentId": event.instrument_id,
            "dataType": event.data_type,
            "payload": event.payload,
            "provenance": provenance,
            "quality": quality,
            "nativeSchema": type(event.native_event).__name__ if event.native_event is not None else None,
        }

    def accept(self, event: RecordedEvent) -> None:
        """Durably journal an accepted event before making it pending for Parquet."""

        if self.state is not RecorderState.ACTIVE:
            raise RecorderError(f"recorder is not accepting events: {self.state}")
        if event.provenance.ingress_ordinal <= self._last_ingress_ordinal:
            raise ValueError("ingress_ordinal must strictly increase for a recorder session")
        if len(self._queue) >= self.max_queue_events:
            self.state = RecorderState.OVERFLOW
            self._append_journal({"kind": "failure", "state": self.state.value, "reason": "bounded queue overflow"})
            raise RecorderOverflow("bounded recorder queue overflowed; dataset cannot be certified")
        if event.quality.integrity is not IntegrityState.VERIFIED:
            self._append_journal({"kind": "quality", "quality": self._event_journal_entry(event)["quality"]})
            self.state = RecorderState.GAP
            raise RecorderError("non-verified feed-quality epoch prevents dataset certification")
        self._append_journal(self._event_journal_entry(event))
        self._queue.append(event)
        self._last_ingress_ordinal = event.provenance.ingress_ordinal
        self._instruments.add(event.instrument_id)
        self._created_at_ns = max(self._created_at_ns, event.provenance.available_at_ns)
        self._checkpoint_cursor(event.provenance.ingress_ordinal)

    def _write_fragment(self, events: list[RecordedEvent], group: int) -> DatasetFragment:
        import pyarrow as pa
        import pyarrow.parquet as pq

        data_type = events[0].data_type
        native = [event.native_event for event in events]
        if any(event.data_type != data_type for event in events):
            raise ValueError("fragment events must share a data type")
        if any(value is None for value in native) and any(value is not None for value in native):
            raise ValueError("a fragment cannot mix native and custom events")
        if all(value is not None for value in native):
            from nautilus_trader.serialization.arrow.serializer import ArrowSerializer

            native_type = type(native[0])
            if any(type(value) is not native_type for value in native):
                raise ValueError("native fragment events must share one exact type")
            table = ArrowSerializer.serialize_batch(native, native_type)
            data_type = native_type.__name__
        else:
            table = pa.Table.from_pylist(
                [
                    {
                        "instrument_id": event.instrument_id,
                        "data_type": event.data_type,
                        "payload_json": _canonical_json(event.payload).decode("utf-8"),
                        "stream_id": event.provenance.stream_id,
                        "subscription_generation": event.provenance.subscription_generation,
                        "ingress_ordinal": event.provenance.ingress_ordinal,
                        "available_at_ns": event.provenance.available_at_ns,
                        "batch_index": event.provenance.batch_index,
                        "quality_epoch": event.quality.epoch,
                    }
                    for event in events
                ]
            )
        start = min(event.provenance.available_at_ns for event in events)
        end = max(event.provenance.available_at_ns for event in events)
        relative = Path("fragments") / data_type / f"{start}-{end}-{group}.parquet"
        destination = self.root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.root / "staging" / f"{self.session_id}-{group}.parquet.tmp"
        try:
            pq.write_table(table, temporary, compression="zstd")
            _fsync(temporary)
            os.replace(temporary, destination)
            _fsync(destination)
        except Exception as error:
            self.state = RecorderState.STORAGE_FAILURE
            raise RecorderStorageError("could not stage and commit Zstd Parquet fragment") from error
        return DatasetFragment(relative.as_posix(), data_type, start, end, len(events), _hash_file(destination))

    def flush(self) -> tuple[DatasetFragment, ...]:
        if self.state is not RecorderState.ACTIVE:
            raise RecorderError(f"recorder cannot flush: {self.state}")
        pending, self._queue = self._queue, []
        groups: dict[tuple[str, str], list[RecordedEvent]] = {}
        for event in pending:
            key = (event.data_type, type(event.native_event).__name__ if event.native_event is not None else "custom")
            groups.setdefault(key, []).append(event)
        committed: list[DatasetFragment] = []
        try:
            for index, events in enumerate(groups.values(), start=len(self._fragments)):
                committed.append(self._write_fragment(events, index))
        except RecorderError:
            raise
        self._fragments.extend(committed)
        return tuple(committed)

    def commit(self, dataset_id: str) -> EventDatasetManifest:
        """Atomically publish a new immutable manifest after all fragment commits."""

        if self.state is not RecorderState.ACTIVE:
            raise RecorderError(f"recorder cannot certify dataset: {self.state}")
        self.flush()
        if not self._fragments or not self._instruments:
            raise ValueError("cannot commit an empty event dataset")
        manifest_value = {
            "datasetId": dataset_id,
            "createdAtNs": str(self._created_at_ns),
            "instruments": sorted(self._instruments),
            "fragments": [
                {
                    "path": item.path, "dataType": item.data_type,
                    "startAvailableNs": str(item.start_available_ns), "endAvailableNs": str(item.end_available_ns),
                    "rows": item.rows, "sha256": item.sha256, "compression": item.compression,
                }
                for item in self._fragments
            ],
            "integrity": IntegrityState.VERIFIED.value,
            "timestampProvenance": self.timestamp_provenance,
            "ordering": "available_at_ns,ingress_ordinal,stream_id,batch_index",
            "contractVersion": 1,
            "version": 2,
            "gaps": [],
        }
        manifest_hash = hashlib.sha256(_canonical_json(manifest_value)).hexdigest()
        manifest_value["manifestSha256"] = manifest_hash
        manifest = EventDatasetManifest(
            dataset_id, self._created_at_ns, tuple(manifest_value["instruments"]), tuple(self._fragments), manifest_hash,
            IntegrityState.VERIFIED, self.timestamp_provenance,
        )
        target = self.root / "manifests" / f"{dataset_id}-{manifest_hash}.json"
        if target.exists():
            raise FileExistsError("immutable manifest already exists")
        temporary = self.root / "staging" / f"{self.session_id}-manifest.tmp"
        try:
            with temporary.open("wb") as output:
                output.write(_canonical_json(manifest_value))
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, target)
            _fsync(target)
        except OSError as error:
            self.state = RecorderState.STORAGE_FAILURE
            raise RecorderStorageError("could not atomically publish manifest") from error
        self._append_journal({"kind": "manifest", "datasetId": dataset_id, "manifestSha256": manifest_hash})
        self.state = RecorderState.CLOSED
        return manifest

    @staticmethod
    def recover(root: str | Path, session_id: str) -> RecorderRecovery:
        """Report durable state without adopting or deleting uncommitted staging files."""

        base = Path(root).resolve()
        checkpoint = base / "sessions" / session_id / "checkpoint.json"
        cursor = None
        if checkpoint.exists():
            try:
                cursor = int(json.loads(checkpoint.read_text(encoding="utf-8"))["durableCursor"])
            except (KeyError, ValueError, json.JSONDecodeError):
                cursor = None
        valid, invalid = [], []
        for manifest in (base / "manifests").glob("*.json") if (base / "manifests").exists() else ():
            try:
                value = json.loads(manifest.read_text(encoding="utf-8"))
                claimed = value.pop("manifestSha256")
                if hashlib.sha256(_canonical_json(value)).hexdigest() != claimed:
                    raise ValueError("manifest hash mismatch")
                valid.append(manifest)
            except (KeyError, ValueError, json.JSONDecodeError):
                invalid.append(manifest)
        staging = base / "staging"
        orphaned = tuple(sorted(staging.glob(f"{session_id}-*"))) if staging.exists() else ()
        return RecorderRecovery(tuple(sorted(valid)), tuple(sorted(invalid)), orphaned, cursor)
