# Local Segment Catalog Contract

**Status:** Internal Track B local-history foundation. The catalog is a read-only, bounded discovery operation over an already-opened local `SegmentStore`. It enumerates only existing immutable records for one explicit normalized symbol ID and bar interval. It does not fetch, synthesize, compact, merge, delete, synchronize, or alter segment files.

> Catalog membership is evidence of one individually verified local immutable payload. It does **not** assert that adjacent entries form continuous history, that data is live, or that another local range exists.

## Query and bound

A catalog query carries an explicit `symbol_id`, `interval_ns`, and `maximum_entries`. The interval must be non-zero. The caller must request from `1` through `256` entries; zero or a greater value is rejected before directory enumeration. The returned entries are sorted by `SegmentKey`, therefore by `start_ns` for a fixed symbol and interval.

The catalog stops after the requested number of verified matching entries and marks `truncated` when further matching metadata remains. It does not scan an unbounded number of payloads merely to fill a viewport.

## Integrity and omission behavior

The catalog scans metadata filenames only. A metadata file is included only after all of the following conditions hold:

| Gate | Outcome when the gate fails |
|---|---|
| Metadata decodes under the supported schema and has a matching explicit symbol and interval. | Unsupported or malformed metadata is counted as `malformed_metadata_entries` and is never surfaced as a segment. |
| Matching metadata has a corresponding payload file. | The entry is counted as `missing_payload_entries` and omitted. |
| The payload length and recorded FNV-1a content hash match the retained metadata. | The entry is counted as `corrupt_payload_entries` and omitted. |
| The individual record is verified. | Its immutable `SegmentMetadata` is returned; no continuity claim is added. |

A filesystem I/O error remains an operation error. Cataloging does not silently convert an inaccessible directory into an empty history.

## Boundary

This is local filesystem discovery only. It opens no network connection and has no provider, Render, cloud synchronization, account, broker, order, strategy execution, user-credential, background process, or persistence side effect. A later history timeline must independently validate bar continuity, segment gaps, freshness, and render/research eligibility.
