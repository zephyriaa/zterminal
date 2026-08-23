//! Local-first cache policy primitives for the desktop Phase 0 foundation.
//!
//! This crate models bounded, provenance-preserving segment retention without
//! exposing an unbounded JSON cache. SQLite/WAL and compressed segment-file I/O
//! are introduced only after the policy and migration contract are validated.

use std::collections::{BTreeSet, HashMap};

use zt_protocol::DataStatus;

/// Identifies a local immutable market-data segment.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct SegmentKey {
    /// Dictionary-backed symbol identifier.
    pub symbol_id: u32,
    /// Base interval represented by the segment.
    pub interval_ns: u64,
    /// Inclusive UTC segment start.
    pub start_ns: u64,
}

/// Metadata retained for a locally cached, verified segment.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SegmentMetadata {
    /// Segment identity.
    pub key: SegmentKey,
    /// On-disk compressed size reserved for the segment.
    pub bytes: u64,
    /// Last local access time in monotonic caller-defined units.
    pub last_access: u64,
    /// Integrity/freshness status that must be surfaced to users.
    pub data_status: DataStatus,
}

/// Configurable local cache budget. Zero is deliberately invalid.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CacheBudget {
    /// Maximum bytes that may be indexed as locally retained segments.
    pub max_bytes: u64,
}

impl CacheBudget {
    /// Creates an explicit non-zero budget.
    #[must_use]
    pub fn new(max_bytes: u64) -> Self {
        assert!(max_bytes > 0, "cache budget must be non-zero");
        Self { max_bytes }
    }
}

/// Result of an upsert, including evictions that a storage worker must delete.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CacheMutation {
    /// Segments displaced to respect the configured budget.
    pub evicted: Vec<SegmentMetadata>,
    /// Total retained bytes after the mutation.
    pub retained_bytes: u64,
}

/// In-memory index for a bounded local segment cache.
///
/// The lookup map and ordered access index make every upsert, touch, and
/// eviction O(log n) or better. This avoids the quadratic eviction behavior
/// that would become unacceptable during long trading sessions.
#[derive(Clone, Debug)]
pub struct CacheIndex {
    budget: CacheBudget,
    entries: HashMap<SegmentKey, SegmentMetadata>,
    access_order: BTreeSet<(u64, SegmentKey)>,
    retained_bytes: u64,
}

impl CacheIndex {
    /// Creates an empty cache index.
    #[must_use]
    pub fn new(budget: CacheBudget) -> Self {
        Self {
            budget,
            entries: HashMap::new(),
            access_order: BTreeSet::new(),
            retained_bytes: 0,
        }
    }

    /// Returns the accounted bytes. Disk usage may differ until the storage
    /// worker applies the returned eviction list transactionally.
    #[must_use]
    pub fn retained_bytes(&self) -> u64 {
        self.retained_bytes
    }

    /// Returns the indexed segment count.
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Returns whether no segments are currently retained.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Updates access time if the segment is present in O(log n) time.
    pub fn touch(&mut self, key: SegmentKey, access_time: u64) -> bool {
        let Some(entry) = self.entries.get_mut(&key) else {
            return false;
        };
        let previous_access = entry.last_access;
        if !self.access_order.remove(&(previous_access, key)) {
            return false;
        }
        entry.last_access = access_time;
        self.access_order.insert((access_time, key));
        true
    }

    /// Adds or replaces one segment and returns least-recently-used eviction
    /// metadata. A segment larger than the entire budget is rejected by
    /// returning it in the eviction list; callers must stream it rather than
    /// retaining it indefinitely.
    pub fn upsert(&mut self, segment: SegmentMetadata) -> CacheMutation {
        if let Some(prior) = self.entries.remove(&segment.key) {
            self.access_order.remove(&(prior.last_access, prior.key));
            self.retained_bytes = self.retained_bytes.saturating_sub(prior.bytes);
        }

        self.retained_bytes = self.retained_bytes.saturating_add(segment.bytes);
        self.access_order.insert((segment.last_access, segment.key));
        self.entries.insert(segment.key, segment);

        let mut evicted = Vec::new();
        while self.retained_bytes > self.budget.max_bytes {
            let Some((last_access, key)) = self.access_order.iter().next().copied() else {
                break;
            };
            self.access_order.remove(&(last_access, key));
            let removed = self
                .entries
                .remove(&key)
                .expect("cache index must be internally consistent");
            self.retained_bytes = self.retained_bytes.saturating_sub(removed.bytes);
            evicted.push(removed);
        }

        CacheMutation {
            evicted,
            retained_bytes: self.retained_bytes,
        }
    }
}

/// User-visible state of a locally saved workspace before any cloud request.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WorkspaceSyncState {
    /// The state exists only locally.
    LocalOnly,
    /// A durable local outbox entry awaits a server acknowledgement.
    Queued,
    /// A server acknowledgement confirms the stored version.
    Synced,
    /// Concurrent changes need explicit user resolution.
    Conflict,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(start_ns: u64, bytes: u64, last_access: u64) -> SegmentMetadata {
        SegmentMetadata {
            key: SegmentKey {
                symbol_id: 1,
                interval_ns: 60,
                start_ns,
            },
            bytes,
            last_access,
            data_status: DataStatus::Live,
        }
    }

    #[test]
    fn evicts_the_least_recently_used_segment() {
        let mut index = CacheIndex::new(CacheBudget::new(10));
        let _ = index.upsert(segment(1, 6, 1));
        let mutation = index.upsert(segment(2, 6, 2));
        assert_eq!(mutation.evicted, vec![segment(1, 6, 1)]);
        assert_eq!(mutation.retained_bytes, 6);
        assert_eq!(index.len(), 1);
    }

    #[test]
    fn refuses_to_retain_a_segment_larger_than_budget() {
        let mut index = CacheIndex::new(CacheBudget::new(10));
        let oversized = segment(1, 11, 1);
        let mutation = index.upsert(oversized);
        assert_eq!(mutation.evicted, vec![oversized]);
        assert_eq!(index.retained_bytes(), 0);
        assert!(index.is_empty());
    }

    #[test]
    fn touching_changes_eviction_priority() {
        let mut index = CacheIndex::new(CacheBudget::new(10));
        let first = segment(1, 5, 1);
        let second = segment(2, 5, 2);
        let _ = index.upsert(first);
        let _ = index.upsert(second);
        assert!(index.touch(first.key, 3));
        let mutation = index.upsert(segment(3, 5, 4));
        assert_eq!(mutation.evicted, vec![second]);
    }
}
