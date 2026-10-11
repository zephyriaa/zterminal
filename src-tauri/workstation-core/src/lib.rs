//! Device-owned workstation persistence. No network, execution or worker access.
use rusqlite::{params, Connection, OptionalExtension};
use rust_decimal::{prelude::ToPrimitive, Decimal};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use zt_core::{
    encode_local_bar_segment, prepare_local_chart_scene, LocalChartScene, LocalSceneRequest,
};
use zt_domain::{
    ArtifactReference, ChartDocumentV3, DocumentReference, ValidatedDocument, WorkspaceDocumentV2,
};
use zt_protocol::{Bar, DataStatus};
use zt_storage::{SegmentKey, SegmentStore};

pub type Result<T> = std::result::Result<T, String>;
pub const MAX_IMPORT_BYTES: usize = 8 * 1024 * 1024;
const MAX_BARS: usize = 100_000;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Dataset {
    pub version: u16,
    pub symbol: String,
    pub source_name: String,
    pub source: ArtifactReference,
    pub segment: ArtifactReference,
    pub tick_size: f64,
    pub quantity_step: f64,
    pub interval_ms: u64,
    pub from_ms: u64,
    pub count: usize,
    pub imported_at_ms: u64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub document: WorkspaceDocumentV2,
    pub chart: ChartDocumentV3,
    pub dataset: Option<Dataset>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub id: String,
    pub name: String,
    pub revision: u64,
}

/// This command accepts contents, never a path supplied by the webview.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Import {
    pub csv: String,
    pub source_name: String,
    pub symbol: String,
    pub interval_ms: u64,
    pub tick_size: f64,
    pub quantity_step: f64,
}

#[derive(Serialize)]
pub struct ChartBar {
    pub t: u64,
    pub o: f64,
    pub h: f64,
    pub l: f64,
    pub c: f64,
    pub v: f64,
}

pub struct Store {
    conn: Connection,
    root: PathBuf,
}
impl Store {
    pub fn open(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref().to_path_buf();
        std::fs::create_dir_all(&root).map_err(err)?;
        let mut conn = Connection::open(root.join("workstation.sqlite3")).map_err(err)?;
        conn.busy_timeout(std::time::Duration::from_secs(3))
            .map_err(err)?;
        let version: u32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(err)?;
        if version > 1 {
            return Err("Unsupported newer workstation database; no downgrade performed".into());
        }
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")
            .map_err(err)?;
        if version == 0 {
            let tx = conn.transaction().map_err(err)?;
            tx.execute_batch("CREATE TABLE artifacts(hash TEXT PRIMARY KEY, bytes BLOB NOT NULL);
                CREATE TABLE workspaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL, payload BLOB NOT NULL, hash TEXT NOT NULL);
                CREATE TABLE state(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                PRAGMA user_version=1;").map_err(err)?;
            tx.commit().map_err(err)?;
        }
        Ok(Self { conn, root })
    }

    pub fn list(&self) -> Result<Vec<Summary>> {
        self.conn
            .prepare("SELECT id,name,revision FROM workspaces ORDER BY name,id")
            .map_err(err)?
            .query_map([], |r| {
                Ok(Summary {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    revision: r.get(2)?,
                })
            })
            .map_err(err)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(err)
    }

    pub fn restore(&self) -> Result<Option<Workspace>> {
        let id: Option<String> = self
            .conn
            .query_row("SELECT value FROM state WHERE key='last'", [], |r| r.get(0))
            .optional()
            .map_err(err)?;
        id.map(|id| self.load(&id)).transpose()
    }

    pub fn select(&self, id: &str) -> Result<Workspace> {
        let workspace = self.load(id)?;
        self.conn.execute("INSERT INTO state VALUES('last',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [id]).map_err(err)?;
        Ok(workspace)
    }

    fn artifact(&self, reference: &ArtifactReference) -> Result<Vec<u8>> {
        reference.validate()?;
        let bytes: Vec<u8> = self
            .conn
            .query_row(
                "SELECT bytes FROM artifacts WHERE hash=?",
                [&reference.sha256],
                |r| r.get(0),
            )
            .map_err(err)?;
        if bytes.len() as u64 != reference.bytes || hash(&bytes) != reference.sha256 {
            return Err("Local artifact integrity check failed; data withheld".into());
        }
        Ok(bytes)
    }

    fn put_artifact(&self, bytes: &[u8]) -> Result<ArtifactReference> {
        let reference = ArtifactReference {
            sha256: hash(bytes),
            bytes: bytes.len() as u64,
        };
        self.conn
            .execute(
                "INSERT OR IGNORE INTO artifacts VALUES (?,?)",
                params![reference.sha256, bytes],
            )
            .map_err(err)?;
        // A pre-existing corrupted blob must not be silently accepted.
        self.artifact(&reference)?;
        Ok(reference)
    }

    pub fn create(&mut self, id: String, name: String) -> Result<Workspace> {
        zt_domain::validate_id(&id)?;
        if self.list()?.iter().any(|w| w.id == id) {
            return Err("Workspace already exists".into());
        }
        let workspace = Workspace {
            document: WorkspaceDocumentV2 {
                version: 2,
                id,
                revision: 1,
                name,
                documents: vec![],
                active_document: None,
                presentation: None,
            },
            chart: ChartDocumentV3 {
                version: 3,
                id: "primary-chart".into(),
                revision: 1,
                dataset: None,
                interval_ms: 60_000,
                visible_from_ms: None,
                visible_to_ms: None,
                indicators: vec![],
                drawings: None,
                replay: None,
            },
            dataset: None,
        };
        self.commit(workspace, 0)
    }

    fn validate(&self, w: &Workspace) -> Result<()> {
        w.document.validate()?;
        w.chart.validate()?;
        if w.chart.id != "primary-chart"
            || !w.chart.indicators.is_empty()
            || w.chart.drawings.is_some()
            || w.chart.replay.is_some()
            || w.document.presentation.is_some()
        {
            return Err("Unsupported Phase 1 chart state".into());
        }
        let chart = w
            .document
            .documents
            .first()
            .ok_or("Chart reference missing")?;
        if w.document.documents.len() != 1
            || w.document.active_document.as_deref() != Some(w.chart.id.as_str())
            || chart.id != w.chart.id
            || chart.revision != w.chart.revision
            || self.artifact(&chart.artifact)? != serde_json::to_vec(&w.chart).map_err(err)?
        {
            return Err("Workspace/chart reference mismatch".into());
        }
        match (&w.dataset, &w.chart.dataset) {
            (None, None) => (),
            (Some(d), Some(reference)) => {
                if d.version != 1
                    || reference.id != "imported-history"
                    || reference.revision != 1
                    || self.artifact(&reference.artifact)? != serde_json::to_vec(d).map_err(err)?
                {
                    return Err("Dataset reference mismatch".into());
                }
                self.artifact(&d.source)?;
                self.artifact(&d.segment)?;
                if w.chart.interval_ms != d.interval_ms {
                    return Err("Chart interval differs from dataset".into());
                }
            }
            _ => return Err("Dataset/chart ownership mismatch".into()),
        }
        Ok(())
    }

    pub fn load(&self, id: &str) -> Result<Workspace> {
        zt_domain::validate_id(id)?;
        let (bytes, digest): (Vec<u8>, String) = self
            .conn
            .query_row(
                "SELECT payload,hash FROM workspaces WHERE id=?",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(err)?;
        if hash(&bytes) != digest {
            return Err("Workspace integrity failed".into());
        }
        let workspace: Workspace = serde_json::from_slice(&bytes).map_err(err)?;
        self.validate(&workspace)?;
        Ok(workspace)
    }

    pub fn save(
        &mut self,
        id: &str,
        revision: u64,
        name: String,
        from: Option<i64>,
        to: Option<i64>,
    ) -> Result<Workspace> {
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; reopen before saving".into());
        }
        if name.trim().is_empty() || name.len() > 256 {
            return Err("Invalid workspace name".into());
        }
        w.document.name = name.trim().into();
        w.document.revision += 1;
        w.chart.revision += 1;
        w.chart.visible_from_ms = from;
        w.chart.visible_to_ms = to;
        self.commit(w, revision)
    }

    fn commit(&mut self, mut w: Workspace, expected: u64) -> Result<Workspace> {
        w.chart.validate()?;
        let reference = self.put_artifact(&serde_json::to_vec(&w.chart).map_err(err)?)?;
        w.document.documents = vec![DocumentReference {
            id: w.chart.id.clone(),
            revision: w.chart.revision,
            artifact: reference,
        }];
        w.document.active_document = Some(w.chart.id.clone());
        self.validate(&w)?;
        let bytes = serde_json::to_vec(&w).map_err(err)?;
        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        let actual: Option<u64> = tx
            .query_row(
                "SELECT revision FROM workspaces WHERE id=?",
                [&w.document.id],
                |r| r.get(0),
            )
            .optional()
            .map_err(err)?;
        if actual.unwrap_or(0) != expected {
            return Err("Workspace changed; reopen before saving".into());
        }
        tx.execute("INSERT INTO workspaces VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,revision=excluded.revision,payload=excluded.payload,hash=excluded.hash",
            params![w.document.id,w.document.name,w.document.revision,bytes,hash(&bytes)]).map_err(err)?;
        tx.execute("INSERT INTO state VALUES('last',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [&w.document.id]).map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(w)
    }

    pub fn import(&mut self, id: &str, revision: u64, input: Import) -> Result<Workspace> {
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; reopen before importing".into());
        }
        let bars = parse_csv(&input, now_ms())?;
        let key = SegmentKey {
            symbol_id: 1,
            interval_ns: input.interval_ms * 1_000_000,
            start_ns: bars[0].open_time_ns,
        };
        let imported_at = now_ms();
        let bytes = encode_local_bar_segment(key, imported_at * 1_000_000, &bars).map_err(err)?;
        let segment = self.put_artifact(&bytes)?;
        let store = SegmentStore::open(self.root.join(&segment.sha256)).map_err(err)?;
        match store.read(key) {
            Ok((_, existing)) if existing == bytes => (),
            Ok(_) => return Err("Existing local segment differs".into()),
            Err(zt_storage::StorageError::SegmentMissing(_)) => {
                store
                    .write(key, &bytes, imported_at * 1_000_000, DataStatus::Live)
                    .map_err(err)?;
            }
            Err(e) => return Err(err(e)),
        }
        let dataset = Dataset {
            version: 1,
            symbol: input.symbol.trim().into(),
            source_name: input.source_name,
            source: self.put_artifact(input.csv.as_bytes())?,
            segment,
            tick_size: input.tick_size,
            quantity_step: input.quantity_step,
            interval_ms: input.interval_ms,
            from_ms: bars[0].open_time_ns / 1_000_000,
            count: bars.len(),
            imported_at_ms: imported_at,
        };
        w.chart.dataset = Some(DocumentReference {
            id: "imported-history".into(),
            revision: 1,
            artifact: self.put_artifact(&serde_json::to_vec(&dataset).map_err(err)?)?,
        });
        w.chart.interval_ms = dataset.interval_ms;
        w.chart.visible_from_ms = None;
        w.chart.visible_to_ms = None;
        w.chart.revision += 1;
        w.document.revision += 1;
        w.dataset = Some(dataset);
        self.commit(w, revision)
    }

    pub fn scene(&self, id: &str, first: usize, count: usize) -> Result<Vec<ChartBar>> {
        let w = self.load(id)?;
        let d = w.dataset.ok_or("No imported historical data available")?;
        let store = SegmentStore::open(self.root.join(&d.segment.sha256)).map_err(err)?;
        let key = SegmentKey {
            symbol_id: 1,
            interval_ns: d.interval_ms * 1_000_000,
            start_ns: d.from_ms * 1_000_000,
        };
        let (_, bytes) = store.read(key).map_err(err)?;
        if hash(&bytes) != d.segment.sha256 {
            return Err("Segment SHA-256 integrity failed; data withheld".into());
        }
        // Historical inspection is intentionally independent of live freshness.
        // Legacy engine `Live` encodes structural validity; the UI always says imported history.
        match prepare_local_chart_scene(
            &store,
            key,
            LocalSceneRequest::new(first, count).map_err(err)?,
            d.imported_at_ms * 1_000_000 + 1,
            u64::MAX,
        )
        .map_err(err)?
        {
            LocalChartScene::Renderable(scene) => Ok(scene
                .candles
                .iter()
                .map(|b| ChartBar {
                    t: b.open_time_ns / 1_000_000,
                    o: b.open_ticks as f64 * d.tick_size,
                    h: b.high_ticks as f64 * d.tick_size,
                    l: b.low_ticks as f64 * d.tick_size,
                    c: b.close_ticks as f64 * d.tick_size,
                    v: b.volume as f64 * d.quantity_step,
                })
                .collect()),
            LocalChartScene::Withheld { .. } => {
                Err("Historical scene unavailable; data withheld".into())
            }
        }
    }
}

fn units(value: &str, step: f64) -> Result<i64> {
    let value = Decimal::from_str_exact(value).map_err(err)?;
    let step = Decimal::from_str_exact(&step.to_string()).map_err(err)?;
    if value <= Decimal::ZERO
        || step <= Decimal::ZERO
        || value.checked_rem(step) != Some(Decimal::ZERO)
    {
        return Err(
            "OHLCV must be positive and exactly representable in the declared increments".into(),
        );
    }
    value
        .checked_div(step)
        .and_then(|n| n.to_i64())
        .filter(|n| *n <= 9_007_199_254_740_991)
        .ok_or_else(|| "OHLCV integer units exceed the supported exact bound".into())
}

fn parse_csv(input: &Import, now: u64) -> Result<Vec<Bar>> {
    if input.csv.len() > MAX_IMPORT_BYTES
        || input.symbol.trim().is_empty()
        || input.symbol.len() > 80
        || input.source_name.is_empty()
        || input.source_name.len() > 256
        || ![input.tick_size, input.quantity_step]
            .iter()
            .all(|x| x.is_finite() && *x > 0.0)
        || ![
            60_000, 300_000, 900_000, 1_800_000, 3_600_000, 14_400_000, 86_400_000,
        ]
        .contains(&input.interval_ms)
    {
        return Err("Invalid import size, identity, units or timeframe".into());
    }
    let mut lines = input.csv.trim().lines();
    if lines.next().map(str::trim) != Some("t,o,h,l,c,v") {
        return Err("CSV header must be t,o,h,l,c,v (UTC epoch milliseconds; prices/volume in declared units)".into());
    }
    let mut bars: Vec<Bar> = vec![];
    for (index, line) in lines.enumerate() {
        if index >= MAX_BARS {
            return Err("Import exceeds 100,000 bars".into());
        }
        let values: Vec<_> = line.split(',').map(str::trim).collect();
        if values.len() != 6 || values.iter().any(|s| s.is_empty()) {
            return Err(format!("Invalid CSV row {}", index + 2));
        }
        let t: u64 = values[0].parse().map_err(err)?;
        if t % input.interval_ms != 0
            || t.checked_add(input.interval_ms).is_none_or(|end| end > now)
            || t > u64::MAX / 1_000_000
            || bars
                .last()
                .is_some_and(|b| b.open_time_ns / 1_000_000 + input.interval_ms != t)
        {
            return Err(
                "History contains unordered, duplicate, gap, future or unaligned timestamps".into(),
            );
        }
        bars.push(Bar {
            symbol_id: 1,
            open_time_ns: t * 1_000_000,
            interval_ns: input.interval_ms * 1_000_000,
            open_ticks: units(values[1], input.tick_size)?,
            high_ticks: units(values[2], input.tick_size)?,
            low_ticks: units(values[3], input.tick_size)?,
            close_ticks: units(values[4], input.tick_size)?,
            volume: units(values[5], input.quantity_step)?,
            last_sequence: index as u64 + 1,
            data_status: DataStatus::Live,
        });
    }
    if bars.is_empty() {
        return Err("CSV contains no history".into());
    }
    // Existing engine codec enforces OHLC and continuity; no repair or deduplication.
    encode_local_bar_segment(
        SegmentKey {
            symbol_id: 1,
            interval_ns: input.interval_ms * 1_000_000,
            start_ns: bars[0].open_time_ns,
        },
        now * 1_000_000,
        &bars,
    )
    .map_err(err)?;
    Ok(bars)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn import(csv: &str) -> Import {
        Import {
            csv: csv.into(),
            source_name: "test fixture.csv".into(),
            symbol: "TEST".into(),
            interval_ms: 60_000,
            tick_size: 0.5,
            quantity_step: 1.0,
        }
    }
    const CSV: &str = "t,o,h,l,c,v\n60000,10,12,9,11,2\n120000,11,13,10,12,3\n180000,12,14,11,13,4";
    #[test]
    fn vertical_slice_restarts_without_original_file_and_conflicts_preserve_commit() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        assert!(store.restore().unwrap().is_none());
        let w = store.create("one".into(), "Local chart".into()).unwrap();
        let w = store.import(&w.document.id, 1, import(CSV)).unwrap();
        assert_eq!(store.scene("one", 0, 3).unwrap()[2].c, 13.0);
        store
            .save(
                "one",
                w.document.revision,
                "Saved chart".into(),
                Some(60000),
                Some(180000),
            )
            .unwrap();
        assert!(store
            .save("one", w.document.revision, "Stale".into(), None, None)
            .is_err());
        drop(store);
        let store = Store::open(root.path()).unwrap();
        let restored = store.restore().unwrap().unwrap();
        assert_eq!(restored.document.name, "Saved chart");
        assert_eq!(restored.chart.visible_from_ms, Some(60000));
        assert_eq!(store.scene("one", 0, 3).unwrap().len(), 3);
        assert_eq!(store.list().unwrap().len(), 1);
    }
    #[test]
    fn invalid_imports_are_rejected_without_mutating_workspace() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        store.create("one".into(), "Chart".into()).unwrap();
        for csv in [
            CSV.replace("120000", "60000"),
            CSV.replace("120000", "240000"),
            CSV.replace("12,9", "8,9"),
            CSV.replace("10,12", "10.1,12"),
            CSV.replace(",2\n", ",0\n"),
            "t,o,h,l,c,v\n".into(),
        ] {
            assert!(store.import("one", 1, import(&csv)).is_err(), "{csv}");
            assert_eq!(store.load("one").unwrap().document.revision, 1);
        }
        assert!(parse_csv(&import(CSV), 100000).is_err());
        assert!(store.scene("one", 0, 3).is_err());
    }
    #[test]
    fn corrupt_artifacts_and_newer_schema_fail_closed() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        store.create("one".into(), "Chart".into()).unwrap();
        store.import("one", 1, import(CSV)).unwrap();
        store
            .conn
            .execute("UPDATE artifacts SET bytes=X'00'", [])
            .unwrap();
        assert!(store.restore().is_err());
        assert!(store.scene("one", 0, 3).is_err());
        store.conn.execute_batch("PRAGMA user_version=99;").unwrap();
        drop(store);
        assert!(Store::open(root.path()).is_err());
    }

    #[test]
    fn selection_is_durable_and_bounded_scenes_withhold_modified_segments() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        store.create("one".into(), "One".into()).unwrap();
        let w = store.import("one", 1, import(CSV)).unwrap();
        store.create("two".into(), "Two".into()).unwrap();
        assert_eq!(store.restore().unwrap().unwrap().document.id, "two");
        store.select("one").unwrap();
        assert_eq!(store.restore().unwrap().unwrap().document.id, "one");
        assert!(store.scene("one", 0, 2001).is_err());
        assert!(store.scene("one", 2, 2).is_err());
        let segment = root
            .path()
            .join(w.dataset.unwrap().segment.sha256)
            .join("segments");
        let path = std::fs::read_dir(segment)
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        std::fs::write(path, b"corrupt test segment").unwrap();
        assert!(store.scene("one", 0, 3).is_err());
        // Corrupt scene is withheld while the workspace's editable intent remains readable.
        assert_eq!(store.load("one").unwrap().document.name, "One");
    }

    #[test]
    fn input_resource_bounds_are_enforced() {
        assert!(units("10.0000000001", 0.5).is_err());
        assert_eq!(units("0.3", 0.1).unwrap(), 3);
        assert!(units("NaN", 0.1).is_err());
        let mut oversized = import(CSV);
        oversized.csv = "x".repeat(MAX_IMPORT_BYTES + 1);
        assert!(parse_csv(&oversized, u64::MAX / 1_000_000).is_err());
        let mut too_many = String::from("t,o,h,l,c,v\n");
        for i in 1..=100_001 {
            too_many.push_str(&format!("{},10,12,9,11,2\n", i * 60_000u64));
        }
        assert!(parse_csv(&import(&too_many), u64::MAX / 1_000_000).is_err());
    }
}
