//! Local-first cache policy and durable persistence primitives.
//!
//! The desktop owns verified historical segments and workspace intent locally.
//! These types deliberately provide bounded file-backed storage with integrity
//! checks before a future SQLite/WAL metadata migration is introduced. No
//! network, cloud synchronization, provider fallback, or fabricated data path
//! exists in this crate.

use std::collections::{BTreeSet, HashMap};
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use zt_protocol::DataStatus;

const SEGMENT_METADATA_VERSION: u16 = 1;
const WORKSPACE_JOURNAL_VERSION: u16 = 1;
const FNV_OFFSET_BASIS: u64 = 14_695_981_039_346_656_037;
const FNV_PRIME: u64 = 1_099_511_628_211;

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
    /// On-disk payload size reserved for the segment.
    pub bytes: u64,
    /// Last local access time in caller-defined monotonic units.
    pub last_access: u64,
    /// Integrity/freshness status that must be surfaced to users.
    pub data_status: DataStatus,
    /// Stable FNV-1a content hash recorded when the payload was written.
    pub content_hash: u64,
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
/// eviction O(log n) or better. This avoids quadratic eviction behavior during
/// long trading sessions.
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
    /// worker applies the returned eviction list.
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

/// A user-visible local availability state that never invents a live feed.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LocalAvailability {
    /// A verified provider event was just observed at the requested local time.
    Live,
    /// Verified local data is within its caller-provided freshness budget.
    Cached {
        /// Age of the last verified local sample in nanoseconds.
        age_ns: u64,
    },
    /// Verified local data exists but exceeds its freshness budget.
    Stale {
        /// Age of the last verified local sample in nanoseconds.
        age_ns: u64,
    },
    /// The requested local range includes a sequence gap or corrupt input.
    Gap,
    /// No verified local data is available for the request.
    Unavailable,
    /// A local payload failed its recorded integrity check and was withheld.
    Corrupt,
}

/// Converts retained provenance into a truthful local availability state.
#[must_use]
pub fn local_availability(
    data_status: DataStatus,
    captured_at_ns: u64,
    now_ns: u64,
    freshness_budget_ns: u64,
) -> LocalAvailability {
    match data_status {
        DataStatus::Gap => LocalAvailability::Gap,
        DataStatus::Unavailable => LocalAvailability::Unavailable,
        DataStatus::Stale => LocalAvailability::Stale {
            age_ns: now_ns.saturating_sub(captured_at_ns),
        },
        DataStatus::Live => {
            let age_ns = now_ns.saturating_sub(captured_at_ns);
            if age_ns == 0 {
                LocalAvailability::Live
            } else if age_ns <= freshness_budget_ns {
                LocalAvailability::Cached { age_ns }
            } else {
                LocalAvailability::Stale { age_ns }
            }
        }
    }
}

/// Errors returned by local storage operations.
#[derive(Debug)]
pub enum StorageError {
    /// Underlying local filesystem operation failed.
    Io(std::io::Error),
    /// Persisted metadata is malformed or does not match the expected format.
    InvalidMetadata,
    /// A caller attempted to replace an immutable segment without an explicit
    /// future compaction/migration operation.
    SegmentAlreadyExists(SegmentKey),
    /// Segment payload bytes disagree with the durable metadata.
    CorruptSegment(SegmentKey),
    /// The requested segment is not locally retained.
    SegmentMissing(SegmentKey),
    /// A workspace journal record would exceed its configured local budget.
    WorkspaceBudgetExceeded,
    /// A workspace journal row is malformed or uses an unknown schema.
    InvalidWorkspaceRecord,
}

impl Display for StorageError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "local storage I/O failed: {error}"),
            Self::InvalidMetadata => write!(formatter, "local segment metadata is invalid"),
            Self::SegmentAlreadyExists(key) => {
                write!(formatter, "local segment already exists: {key:?}")
            }
            Self::CorruptSegment(key) => {
                write!(formatter, "local segment integrity check failed: {key:?}")
            }
            Self::SegmentMissing(key) => write!(formatter, "local segment is unavailable: {key:?}"),
            Self::WorkspaceBudgetExceeded => {
                write!(formatter, "local workspace journal budget was exceeded")
            }
            Self::InvalidWorkspaceRecord => {
                write!(formatter, "local workspace journal record is invalid")
            }
        }
    }
}

impl Error for StorageError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io(error) => Some(error),
            _ => None,
        }
    }
}

impl From<std::io::Error> for StorageError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

/// Stable non-cryptographic hash used to detect accidental local corruption.
///
/// It is not an authenticity mechanism. Provider authenticity and release trust
/// remain separate signed protocol responsibilities.
#[must_use]
pub fn content_hash(bytes: &[u8]) -> u64 {
    bytes.iter().fold(FNV_OFFSET_BASIS, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(FNV_PRIME)
    })
}

/// File-backed immutable local segment store.
#[derive(Clone, Debug)]
pub struct SegmentStore {
    root: PathBuf,
}

impl SegmentStore {
    /// Opens a directory owned by the local user and creates its cache layout.
    pub fn open(root: impl AsRef<Path>) -> Result<Self, StorageError> {
        let root = root.as_ref().to_path_buf();
        fs::create_dir_all(root.join("segments"))?;
        fs::create_dir_all(root.join("metadata"))?;
        Ok(Self { root })
    }

    /// Writes an immutable verified segment and its independently readable metadata.
    ///
    /// Existing keys are rejected. A future compaction path must write a new
    /// segment identity and explicitly retire the old record, rather than
    /// silently overwriting user-visible history.
    pub fn write(
        &self,
        key: SegmentKey,
        bytes: &[u8],
        last_access: u64,
        data_status: DataStatus,
    ) -> Result<SegmentMetadata, StorageError> {
        let payload_path = self.payload_path(key);
        let metadata_path = self.metadata_path(key);
        if payload_path.exists() || metadata_path.exists() {
            return Err(StorageError::SegmentAlreadyExists(key));
        }

        write_new_file(&payload_path, bytes)?;
        let metadata = SegmentMetadata {
            key,
            bytes: u64::try_from(bytes.len()).map_err(|_| StorageError::InvalidMetadata)?,
            last_access,
            data_status,
            content_hash: content_hash(bytes),
        };
        if let Err(error) = write_new_file(&metadata_path, metadata.encode().as_bytes()) {
            let _ = fs::remove_file(&payload_path);
            return Err(error);
        }
        Ok(metadata)
    }

    /// Reads and verifies a locally retained segment without changing its provenance.
    pub fn read(&self, key: SegmentKey) -> Result<(SegmentMetadata, Vec<u8>), StorageError> {
        let metadata = self.read_metadata(key)?;
        let payload_path = self.payload_path(key);
        let mut payload = Vec::new();
        File::open(&payload_path)
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::NotFound {
                    StorageError::SegmentMissing(key)
                } else {
                    StorageError::Io(error)
                }
            })?
            .read_to_end(&mut payload)?;

        if u64::try_from(payload.len()).ok() != Some(metadata.bytes)
            || content_hash(&payload) != metadata.content_hash
        {
            return Err(StorageError::CorruptSegment(key));
        }
        Ok((metadata, payload))
    }

    /// Reads durable metadata for one local segment.
    pub fn read_metadata(&self, key: SegmentKey) -> Result<SegmentMetadata, StorageError> {
        let metadata_path = self.metadata_path(key);
        let encoded = fs::read_to_string(&metadata_path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                StorageError::SegmentMissing(key)
            } else {
                StorageError::Io(error)
            }
        })?;
        SegmentMetadata::decode(&encoded)
            .filter(|metadata| metadata.key == key)
            .ok_or(StorageError::InvalidMetadata)
    }

    /// Lists only complete metadata entries whose payload files still exist.
    pub fn list_metadata(&self) -> Result<Vec<SegmentMetadata>, StorageError> {
        let mut metadata = Vec::new();
        for entry in fs::read_dir(self.root.join("metadata"))? {
            let entry = entry?;
            if entry
                .path()
                .extension()
                .is_none_or(|extension| extension != "meta")
            {
                continue;
            }
            let encoded = fs::read_to_string(entry.path())?;
            let Some(segment) = SegmentMetadata::decode(&encoded) else {
                continue;
            };
            if self.payload_path(segment.key).exists() {
                metadata.push(segment);
            }
        }
        metadata.sort_by_key(|entry| entry.key);
        Ok(metadata)
    }

    /// Deletes a payload and metadata record after cache eviction or explicit user action.
    pub fn delete(&self, key: SegmentKey) -> Result<(), StorageError> {
        for path in [self.payload_path(key), self.metadata_path(key)] {
            match fs::remove_file(path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(StorageError::Io(error)),
            }
        }
        Ok(())
    }

    fn payload_path(&self, key: SegmentKey) -> PathBuf {
        self.root
            .join("segments")
            .join(segment_stem(key))
            .with_extension("bin")
    }

    fn metadata_path(&self, key: SegmentKey) -> PathBuf {
        self.root
            .join("metadata")
            .join(segment_stem(key))
            .with_extension("meta")
    }
}

impl SegmentMetadata {
    fn encode(self) -> String {
        format!(
            "version={SEGMENT_METADATA_VERSION}\nsymbol_id={}\ninterval_ns={}\nstart_ns={}\nbytes={}\nlast_access={}\ndata_status={}\ncontent_hash={}\n",
            self.key.symbol_id,
            self.key.interval_ns,
            self.key.start_ns,
            self.bytes,
            self.last_access,
            data_status_code(self.data_status),
            self.content_hash,
        )
    }

    fn decode(encoded: &str) -> Option<Self> {
        let values = key_value_map(encoded)?;
        if values.get("version")?.parse::<u16>().ok()? != SEGMENT_METADATA_VERSION {
            return None;
        }
        Some(Self {
            key: SegmentKey {
                symbol_id: values.get("symbol_id")?.parse().ok()?,
                interval_ns: values.get("interval_ns")?.parse().ok()?,
                start_ns: values.get("start_ns")?.parse().ok()?,
            },
            bytes: values.get("bytes")?.parse().ok()?,
            last_access: values.get("last_access")?.parse().ok()?,
            data_status: data_status_from_code(values.get("data_status")?.parse().ok()?)?,
            content_hash: values.get("content_hash")?.parse().ok()?,
        })
    }
}

/// Bounded journal quota for durable local workspace intent.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WorkspaceJournalBudget {
    /// Maximum durable journal bytes before compaction is required.
    pub max_bytes: u64,
}

impl WorkspaceJournalBudget {
    /// Creates an explicit non-zero journal quota.
    #[must_use]
    pub fn new(max_bytes: u64) -> Self {
        assert!(max_bytes > 0, "workspace journal budget must be non-zero");
        Self { max_bytes }
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

/// One durable local workspace snapshot. The payload is opaque to storage so UI
/// schema migrations remain explicit at the caller boundary.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSnapshot {
    /// Caller-stable workspace identifier.
    pub workspace_id: u64,
    /// Strictly increasing local revision.
    pub revision: u64,
    /// UTC save time in nanoseconds supplied by the caller.
    pub saved_at_ns: u64,
    /// Explicit local/cloud acknowledgement state.
    pub sync_state: WorkspaceSyncState,
    /// Versioned caller payload, stored locally without contacting a server.
    pub payload: Vec<u8>,
}

/// Append-only bounded local journal for workspace snapshots.
#[derive(Clone, Debug)]
pub struct WorkspaceJournal {
    path: PathBuf,
    budget: WorkspaceJournalBudget,
}

impl WorkspaceJournal {
    /// Opens a per-user journal. Cloud synchronization is neither opened nor required.
    pub fn open(
        root: impl AsRef<Path>,
        budget: WorkspaceJournalBudget,
    ) -> Result<Self, StorageError> {
        let root = root.as_ref();
        fs::create_dir_all(root)?;
        Ok(Self {
            path: root.join("workspace.journal"),
            budget,
        })
    }

    /// Appends and flushes one durable workspace snapshot within the local quota.
    pub fn append(&self, snapshot: &WorkspaceSnapshot) -> Result<(), StorageError> {
        let record = encode_workspace_snapshot(snapshot);
        let current_bytes = fs::metadata(&self.path).map_or(0, |metadata| metadata.len());
        let record_bytes =
            u64::try_from(record.len()).map_err(|_| StorageError::WorkspaceBudgetExceeded)?;
        if current_bytes.saturating_add(record_bytes) > self.budget.max_bytes {
            return Err(StorageError::WorkspaceBudgetExceeded);
        }

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        file.write_all(record.as_bytes())?;
        file.sync_data()?;
        Ok(())
    }

    /// Replays the latest valid snapshot for every workspace without a server request.
    pub fn latest(&self) -> Result<HashMap<u64, WorkspaceSnapshot>, StorageError> {
        let encoded = match fs::read_to_string(&self.path) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(HashMap::new()),
            Err(error) => return Err(StorageError::Io(error)),
        };

        let mut latest = HashMap::new();
        for line in encoded.lines() {
            let snapshot = decode_workspace_snapshot(line)?;
            let replace = latest
                .get(&snapshot.workspace_id)
                .is_none_or(|prior: &WorkspaceSnapshot| snapshot.revision >= prior.revision);
            if replace {
                latest.insert(snapshot.workspace_id, snapshot);
            }
        }
        Ok(latest)
    }

    /// Rewrites the journal with only the latest local snapshot per workspace.
    ///
    /// This is an explicit local maintenance operation. It makes no network
    /// request, preserves every retained sync state, and refuses to emit a file
    /// exceeding the configured local journal budget.
    pub fn compact(&self) -> Result<(), StorageError> {
        let mut snapshots: Vec<_> = self.latest()?.into_values().collect();
        snapshots.sort_by_key(|snapshot| snapshot.workspace_id);
        let encoded: String = snapshots.iter().map(encode_workspace_snapshot).collect();
        let encoded_bytes =
            u64::try_from(encoded.len()).map_err(|_| StorageError::WorkspaceBudgetExceeded)?;
        if encoded_bytes > self.budget.max_bytes {
            return Err(StorageError::WorkspaceBudgetExceeded);
        }
        let temporary_path = self.path.with_extension("journal.next");
        fs::write(&temporary_path, encoded)?;
        OpenOptions::new()
            .write(true)
            .open(&temporary_path)?
            .sync_all()?;
        replace_local_file(&temporary_path, &self.path)?;
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_local_file(temporary_path: &Path, destination_path: &Path) -> Result<(), StorageError> {
    fs::rename(temporary_path, destination_path)?;
    Ok(())
}

#[cfg(windows)]
fn replace_local_file(temporary_path: &Path, destination_path: &Path) -> Result<(), StorageError> {
    // Windows compaction uses a recoverable in-place local rewrite. Retain the
    // current journal bytes in memory so an I/O failure can attempt restoration.
    // No cloud request or unsafe system API is used on this path.
    let replacement = fs::read(temporary_path).map_err(|error| {
        StorageError::Io(std::io::Error::new(
            error.kind(),
            format!("read replacement journal: {error}"),
        ))
    })?;
    let prior = fs::read(destination_path).ok();
    let write_result = (|| -> Result<(), std::io::Error> {
        let mut destination = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(destination_path)?;
        destination.write_all(&replacement)?;
        destination.sync_all()?;
        Ok(())
    })();
    if let Err(error) = write_result {
        if let Some(previous) = prior {
            let _ = fs::write(destination_path, previous);
        }
        return Err(StorageError::Io(std::io::Error::new(
            error.kind(),
            format!("replace local workspace journal: {error}"),
        )));
    }
    fs::remove_file(temporary_path).map_err(|error| {
        StorageError::Io(std::io::Error::new(
            error.kind(),
            format!("remove replacement journal: {error}"),
        ))
    })?;
    Ok(())
}

fn segment_stem(key: SegmentKey) -> String {
    format!("s{}_i{}_t{}", key.symbol_id, key.interval_ns, key.start_ns)
}

fn write_new_file(path: &Path, bytes: &[u8]) -> Result<(), StorageError> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(())
}

fn data_status_code(status: DataStatus) -> u8 {
    match status {
        DataStatus::Live => 1,
        DataStatus::Stale => 2,
        DataStatus::Gap => 3,
        DataStatus::Unavailable => 4,
    }
}

fn data_status_from_code(code: u8) -> Option<DataStatus> {
    match code {
        1 => Some(DataStatus::Live),
        2 => Some(DataStatus::Stale),
        3 => Some(DataStatus::Gap),
        4 => Some(DataStatus::Unavailable),
        _ => None,
    }
}

fn workspace_state_code(state: WorkspaceSyncState) -> u8 {
    match state {
        WorkspaceSyncState::LocalOnly => 1,
        WorkspaceSyncState::Queued => 2,
        WorkspaceSyncState::Synced => 3,
        WorkspaceSyncState::Conflict => 4,
    }
}

fn workspace_state_from_code(code: u8) -> Option<WorkspaceSyncState> {
    match code {
        1 => Some(WorkspaceSyncState::LocalOnly),
        2 => Some(WorkspaceSyncState::Queued),
        3 => Some(WorkspaceSyncState::Synced),
        4 => Some(WorkspaceSyncState::Conflict),
        _ => None,
    }
}

fn key_value_map(encoded: &str) -> Option<HashMap<&str, &str>> {
    let mut values = HashMap::new();
    for line in encoded.lines() {
        let (key, value) = line.split_once('=')?;
        if values.insert(key, value).is_some() {
            return None;
        }
    }
    Some(values)
}

fn encode_workspace_snapshot(snapshot: &WorkspaceSnapshot) -> String {
    format!(
        "{WORKSPACE_JOURNAL_VERSION}|{}|{}|{}|{}|{}\n",
        snapshot.workspace_id,
        snapshot.revision,
        snapshot.saved_at_ns,
        workspace_state_code(snapshot.sync_state),
        hex_encode(&snapshot.payload),
    )
}

fn decode_workspace_snapshot(line: &str) -> Result<WorkspaceSnapshot, StorageError> {
    let mut fields = line.split('|');
    let version = fields.next().and_then(|value| value.parse::<u16>().ok());
    if version != Some(WORKSPACE_JOURNAL_VERSION) {
        return Err(StorageError::InvalidWorkspaceRecord);
    }
    let workspace_id = fields
        .next()
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or(StorageError::InvalidWorkspaceRecord)?;
    let revision = fields
        .next()
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or(StorageError::InvalidWorkspaceRecord)?;
    let saved_at_ns = fields
        .next()
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or(StorageError::InvalidWorkspaceRecord)?;
    let sync_state = fields
        .next()
        .and_then(|value| value.parse::<u8>().ok())
        .and_then(workspace_state_from_code)
        .ok_or(StorageError::InvalidWorkspaceRecord)?;
    let payload = fields
        .next()
        .and_then(hex_decode)
        .ok_or(StorageError::InvalidWorkspaceRecord)?;
    if fields.next().is_some() {
        return Err(StorageError::InvalidWorkspaceRecord);
    }
    Ok(WorkspaceSnapshot {
        workspace_id,
        revision,
        saved_at_ns,
        sync_state,
        payload,
    })
}

fn hex_encode(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len().saturating_mul(2));
    for byte in bytes {
        output.push(char::from(DIGITS[usize::from(byte >> 4)]));
        output.push(char::from(DIGITS[usize::from(byte & 0x0F)]));
    }
    output
}

fn hex_decode(encoded: &str) -> Option<Vec<u8>> {
    let (pairs, remainder) = encoded.as_bytes().as_chunks::<2>();
    if !remainder.is_empty() {
        return None;
    }
    pairs
        .iter()
        .map(|pair| {
            let high = char::from(pair[0]).to_digit(16)?;
            let low = char::from(pair[1]).to_digit(16)?;
            u8::try_from((high << 4) | low).ok()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

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
            content_hash: 0,
        }
    }

    fn temporary_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after the epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("zt-storage-{label}-{nonce}"))
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

    #[test]
    fn reports_live_cached_and_stale_without_manufacturing_freshness() {
        assert_eq!(
            local_availability(DataStatus::Live, 100, 100, 10),
            LocalAvailability::Live
        );
        assert_eq!(
            local_availability(DataStatus::Live, 100, 105, 10),
            LocalAvailability::Cached { age_ns: 5 }
        );
        assert_eq!(
            local_availability(DataStatus::Live, 100, 111, 10),
            LocalAvailability::Stale { age_ns: 11 }
        );
        assert_eq!(
            local_availability(DataStatus::Gap, 100, 100, 10),
            LocalAvailability::Gap
        );
        assert_eq!(
            local_availability(DataStatus::Unavailable, 100, 100, 10),
            LocalAvailability::Unavailable
        );
    }

    #[test]
    fn persists_and_verifies_an_immutable_local_segment() {
        let root = temporary_root("segment");
        let store = SegmentStore::open(&root).expect("store should open");
        let key = SegmentKey {
            symbol_id: 7,
            interval_ns: 60,
            start_ns: 1_000,
        };
        let bytes = b"verified-local-history";
        let metadata = store
            .write(key, bytes, 42, DataStatus::Live)
            .expect("segment should persist");
        assert_eq!(metadata.content_hash, content_hash(bytes));
        assert_eq!(store.read(key).expect("segment should verify").1, bytes);
        assert_eq!(
            store.list_metadata().expect("metadata should list"),
            vec![metadata]
        );
        assert!(matches!(
            store.write(key, bytes, 43, DataStatus::Live),
            Err(StorageError::SegmentAlreadyExists(_))
        ));
        store.delete(key).expect("segment should delete");
        assert!(matches!(
            store.read(key),
            Err(StorageError::SegmentMissing(_))
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn withholds_a_corrupt_local_segment() {
        let root = temporary_root("corrupt");
        let store = SegmentStore::open(&root).expect("store should open");
        let key = SegmentKey {
            symbol_id: 9,
            interval_ns: 60,
            start_ns: 2_000,
        };
        store
            .write(key, b"trusted-before-corruption", 1, DataStatus::Live)
            .expect("segment should persist");
        let path = root
            .join("segments")
            .join(segment_stem(key))
            .with_extension("bin");
        fs::write(path, b"modified-without-metadata").expect("test corruption should write");
        assert!(
            matches!(store.read(key), Err(StorageError::CorruptSegment(corrupt_key)) if corrupt_key == key)
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn journals_latest_workspace_locally_with_no_cloud_dependency() {
        let root = temporary_root("workspace");
        let journal = WorkspaceJournal::open(&root, WorkspaceJournalBudget::new(1_024))
            .expect("journal should open");
        journal
            .append(&WorkspaceSnapshot {
                workspace_id: 1,
                revision: 1,
                saved_at_ns: 10,
                sync_state: WorkspaceSyncState::LocalOnly,
                payload: b"first".to_vec(),
            })
            .expect("first snapshot should persist");
        journal
            .append(&WorkspaceSnapshot {
                workspace_id: 1,
                revision: 2,
                saved_at_ns: 20,
                sync_state: WorkspaceSyncState::Queued,
                payload: b"latest".to_vec(),
            })
            .expect("latest snapshot should persist");
        let latest = journal.latest().expect("journal should replay");
        assert_eq!(
            latest.get(&1).expect("workspace should exist").payload,
            b"latest"
        );
        assert_eq!(
            latest.get(&1).expect("workspace should exist").sync_state,
            WorkspaceSyncState::Queued
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn compacts_workspace_journal_locally_without_losing_latest_snapshot() {
        let root = temporary_root("workspace-compact");
        let journal = WorkspaceJournal::open(&root, WorkspaceJournalBudget::new(1_024))
            .expect("journal should open");
        for revision in 1..=3 {
            journal
                .append(&WorkspaceSnapshot {
                    workspace_id: 4,
                    revision,
                    saved_at_ns: revision,
                    sync_state: WorkspaceSyncState::LocalOnly,
                    payload: format!("revision-{revision}").into_bytes(),
                })
                .expect("snapshot should persist");
        }
        let before = fs::metadata(root.join("workspace.journal"))
            .expect("journal should exist")
            .len();
        journal.compact().expect("local compaction should succeed");
        let after = fs::metadata(root.join("workspace.journal"))
            .expect("compacted journal should exist")
            .len();
        assert!(after < before);
        assert_eq!(
            journal
                .latest()
                .expect("latest snapshot should replay")
                .get(&4)
                .expect("workspace should remain")
                .payload,
            b"revision-3"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_workspace_records_that_exceed_the_local_budget() {
        let root = temporary_root("budget");
        let journal = WorkspaceJournal::open(&root, WorkspaceJournalBudget::new(10))
            .expect("journal should open");
        let result = journal.append(&WorkspaceSnapshot {
            workspace_id: 1,
            revision: 1,
            saved_at_ns: 1,
            sync_state: WorkspaceSyncState::LocalOnly,
            payload: vec![7; 64],
        });
        assert!(matches!(result, Err(StorageError::WorkspaceBudgetExceeded)));
        let _ = fs::remove_dir_all(root);
    }
}
