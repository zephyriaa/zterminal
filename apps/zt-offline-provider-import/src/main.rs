//! Bounded local-only importer for previously obtained Binance aggregate-trade frames.
//!
//! This command never opens a network connection, accepts credentials, or selects a
//! provider fallback. It only decodes a caller-supplied local file and may write one
//! immutable verified local segment when `--flush` is explicitly requested.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;

use zt_adapters::{
    AdapterEvent, BinanceAggregateTradeAdapter, LocalPersistenceError, LocalPersistenceEvent,
    LocalProviderPersistenceSession, PublicProvider, PublicTradeSubscription,
};
use zt_storage::{SegmentMetadata, SegmentStore};

const MAXIMUM_INPUT_BYTES: u64 = 16 * 1024 * 1024;
const MAXIMUM_INPUT_FRAMES: usize = 100_000;

#[derive(Clone, Debug, Eq, PartialEq)]
struct ImportRequest {
    frame_file: PathBuf,
    root: PathBuf,
    provider_symbol: String,
    symbol_id: u32,
    price_scale: i64,
    quantity_scale: i64,
    stream_id: u32,
    interval_ns: u64,
    maximum_bars: usize,
    captured_at_ns: u64,
    access_time: u64,
    flush: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TerminalOutcome {
    NotRequested,
    Empty,
    Withheld,
    Persisted,
    ExistingSegment,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ImportReport {
    source_frames: usize,
    adapter_gaps: usize,
    withheld_events: usize,
    retained_completed_bars: usize,
    outcome: TerminalOutcome,
    persisted: Option<SegmentMetadata>,
}

fn main() -> ExitCode {
    match parse_request(env::args().skip(1).collect()).and_then(|request| execute_import(&request))
    {
        Ok((request, report)) => {
            print_report(&request, &report);
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("offline provider import failed: {error}");
            ExitCode::from(2)
        }
    }
}

fn parse_request(arguments: Vec<String>) -> Result<ImportRequest, String> {
    let mut values = BTreeMap::new();
    let mut flush = false;
    for argument in arguments {
        if argument == "--flush" {
            if flush {
                return Err("duplicate --flush flag".to_owned());
            }
            flush = true;
            continue;
        }
        let Some((name, value)) = argument.split_once('=') else {
            return Err(format!("unsupported argument: {argument}"));
        };
        if !name.starts_with("--")
            || value.is_empty()
            || values.insert(name.to_owned(), value.to_owned()).is_some()
        {
            return Err(format!("duplicate or invalid argument: {argument}"));
        }
    }
    let provider = required(&mut values, "--provider")?;
    if provider != "binance-spot-aggtrade" {
        return Err("only --provider=binance-spot-aggtrade is supported".to_owned());
    }
    let request = ImportRequest {
        frame_file: PathBuf::from(required(&mut values, "--frame-file")?),
        root: PathBuf::from(required(&mut values, "--root")?),
        provider_symbol: required(&mut values, "--provider-symbol")?,
        symbol_id: parse_number(&mut values, "--symbol-id")?,
        price_scale: parse_number(&mut values, "--price-scale")?,
        quantity_scale: parse_number(&mut values, "--quantity-scale")?,
        stream_id: parse_number(&mut values, "--stream-id")?,
        interval_ns: parse_number(&mut values, "--interval-ns")?,
        maximum_bars: parse_number(&mut values, "--maximum-bars")?,
        captured_at_ns: parse_number(&mut values, "--captured-at-ns")?,
        access_time: parse_number(&mut values, "--access-time")?,
        flush,
    };
    if !values.is_empty() {
        return Err(format!(
            "unsupported argument: {}",
            values.keys().next().expect("non-empty map")
        ));
    }
    if request.provider_symbol.is_empty() || request.interval_ns == 0 || request.maximum_bars == 0 {
        return Err("provider symbol, interval, and maximum bars must be non-zero".to_owned());
    }
    Ok(request)
}

fn required(values: &mut BTreeMap<String, String>, name: &str) -> Result<String, String> {
    values
        .remove(name)
        .ok_or_else(|| format!("missing required argument: {name}"))
}

fn parse_number<T>(values: &mut BTreeMap<String, String>, name: &str) -> Result<T, String>
where
    T: std::str::FromStr,
{
    let value = required(values, name)?;
    value
        .parse::<T>()
        .map_err(|_| format!("invalid numeric argument: {name}"))
}

fn execute_import(request: &ImportRequest) -> Result<(ImportRequest, ImportReport), String> {
    let metadata = fs::metadata(&request.frame_file).map_err(|_| {
        format!(
            "frame file is unavailable: {}",
            request.frame_file.display()
        )
    })?;
    if metadata.len() == 0 || metadata.len() > MAXIMUM_INPUT_BYTES {
        return Err("frame file exceeds the bounded local input size".to_owned());
    }
    let bytes = fs::read(&request.frame_file).map_err(|_| {
        format!(
            "frame file could not be read: {}",
            request.frame_file.display()
        )
    })?;
    let text = std::str::from_utf8(&bytes).map_err(|_| "frame file must be UTF-8".to_owned())?;
    let subscription = PublicTradeSubscription {
        provider: PublicProvider::BinanceSpot,
        symbol_id: request.symbol_id,
        provider_symbol: Box::leak(request.provider_symbol.clone().into_boxed_str()),
        price_scale: request.price_scale,
        quantity_scale: request.quantity_scale,
        stream_id: request.stream_id,
    };
    let mut adapter = BinanceAggregateTradeAdapter::new(subscription)
        .map_err(|_| "provider subscription configuration is invalid".to_owned())?;
    let mut session = LocalProviderPersistenceSession::new(
        request.symbol_id,
        request.interval_ns,
        request.maximum_bars,
    )
    .map_err(str::to_owned)?;
    let mut source_frames = 0_usize;
    let mut adapter_gaps = 0_usize;
    let mut withheld_events = 0_usize;
    for (zero_based_line, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim_end_matches('\r');
        if line.is_empty() {
            return Err(format!("empty frame line: {}", zero_based_line + 1));
        }
        source_frames = source_frames.saturating_add(1);
        if source_frames > MAXIMUM_INPUT_FRAMES {
            return Err("frame count exceeds the bounded local import limit".to_owned());
        }
        let event = adapter
            .decode(line.as_bytes())
            .map_err(|_| format!("rejected provider frame at line {}", zero_based_line + 1))?;
        if matches!(event, AdapterEvent::Gap { .. }) {
            adapter_gaps = adapter_gaps.saturating_add(1);
        }
        if matches!(
            session.ingest_adapter_event(event),
            LocalPersistenceEvent::Withheld { .. }
        ) {
            withheld_events = withheld_events.saturating_add(1);
        }
    }
    if source_frames == 0 {
        return Err("frame file contains no provider frames".to_owned());
    }
    let retained_completed_bars = session.completed_bar_count();
    let (outcome, persisted) = if !request.flush {
        (TerminalOutcome::NotRequested, None)
    } else {
        let store = SegmentStore::open(&request.root)
            .map_err(|_| format!("local store could not open: {}", request.root.display()))?;
        match session.flush(&store, request.captured_at_ns, request.access_time) {
            Ok(metadata) => (TerminalOutcome::Persisted, Some(metadata)),
            Err(LocalPersistenceError::EmptyBatch) => (TerminalOutcome::Empty, None),
            Err(LocalPersistenceError::DegradedBatch) => (TerminalOutcome::Withheld, None),
            Err(LocalPersistenceError::ExistingSegment(_)) => {
                (TerminalOutcome::ExistingSegment, None)
            }
            Err(LocalPersistenceError::Encode(_)) | Err(LocalPersistenceError::Storage(_)) => {
                return Err("local immutable segment write failed".to_owned());
            }
        }
    };
    Ok((
        request.clone(),
        ImportReport {
            source_frames,
            adapter_gaps,
            withheld_events,
            retained_completed_bars,
            outcome,
            persisted,
        },
    ))
}

fn outcome_name(outcome: TerminalOutcome) -> &'static str {
    match outcome {
        TerminalOutcome::NotRequested => "not_requested",
        TerminalOutcome::Empty => "empty",
        TerminalOutcome::Withheld => "withheld",
        TerminalOutcome::Persisted => "persisted",
        TerminalOutcome::ExistingSegment => "existing_segment",
    }
}

fn print_report(request: &ImportRequest, report: &ImportReport) {
    let persisted = report.persisted.as_ref();
    println!(
        concat!(
            "{{\n",
            "  \"schema_version\": 1,\n",
            "  \"network_opened\": false,\n",
            "  \"provider\": \"binance-spot-aggtrade\",\n",
            "  \"source_frames\": {source_frames},\n",
            "  \"adapter_gaps\": {adapter_gaps},\n",
            "  \"withheld_events\": {withheld_events},\n",
            "  \"retained_completed_bars\": {retained_completed_bars},\n",
            "  \"flush_requested\": {flush_requested},\n",
            "  \"outcome\": \"{outcome}\",\n",
            "  \"local_root\": \"{root}\",\n",
            "  \"segment\": {segment}\n",
            "}}"
        ),
        source_frames = report.source_frames,
        adapter_gaps = report.adapter_gaps,
        withheld_events = report.withheld_events,
        retained_completed_bars = report.retained_completed_bars,
        flush_requested = request.flush,
        outcome = outcome_name(report.outcome),
        root = json_escape(&request.root.to_string_lossy()),
        segment = persisted
            .map(|metadata| format!(
                "{{\"symbol_id\":{},\"interval_ns\":{},\"start_ns\":{},\"bytes\":{}}}",
                metadata.key.symbol_id,
                metadata.key.interval_ns,
                metadata.key.start_ns,
                metadata.bytes
            ))
            .unwrap_or_else(|| "null".to_owned()),
    );
}

fn json_escape(value: &str) -> String {
    let mut output = String::new();
    for character in value.chars() {
        match character {
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            _ if character.is_control() => output.push('?'),
            _ => output.push(character),
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use zt_core::{prepare_local_chart_scene, LocalChartScene, LocalSceneRequest};

    fn temporary_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("zt-offline-import-{label}-{nonce}"))
    }

    fn frame(sequence: u64, time_ms: u64) -> String {
        format!(
            "{{\"e\":\"aggTrade\",\"E\":{time_ms},\"s\":\"BTCUSDT\",\"a\":{sequence},\"p\":\"100.00\",\"q\":\"1.000\",\"T\":{time_ms},\"m\":false}}"
        )
    }

    fn request(file: PathBuf, root: PathBuf, flush: bool) -> ImportRequest {
        ImportRequest {
            frame_file: file,
            root,
            provider_symbol: "btcusdt".to_owned(),
            symbol_id: 1,
            price_scale: 100,
            quantity_scale: 1_000,
            stream_id: 7,
            interval_ns: 1_000_000,
            maximum_bars: 10,
            captured_at_ns: 3_000_000,
            access_time: 9,
            flush,
        }
    }

    #[test]
    fn import_persists_verified_completed_bars_for_a_local_chart_scene() {
        let root = temporary_root("persisted");
        let file = root.with_extension("frames");
        fs::write(
            &file,
            format!("{}\n{}\n{}\n", frame(1, 1), frame(2, 2), frame(3, 3)),
        )
        .expect("frame fixture should write");
        let (_, report) = execute_import(&request(file.clone(), root.clone(), true))
            .expect("verified local frames should import");
        assert_eq!(report.outcome, TerminalOutcome::Persisted);
        let metadata = report.persisted.expect("persisted local segment");
        let store = SegmentStore::open(&root).expect("local store should open");
        let scene = prepare_local_chart_scene(
            &store,
            metadata.key,
            LocalSceneRequest::new(0, 2).expect("scene request"),
            3_000_000,
            1,
        )
        .expect("persisted segment should prepare a native-compatible local scene");
        assert!(matches!(scene, LocalChartScene::Renderable(scene) if scene.candles.len() == 2));
        let _ = fs::remove_file(file);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn gaps_are_withheld_and_no_flush_leaves_no_segment() {
        let root = temporary_root("gap");
        let file = root.with_extension("frames");
        fs::write(&file, format!("{}\n{}\n", frame(1, 1), frame(3, 3)))
            .expect("frame fixture should write");
        let (_, report) = execute_import(&request(file.clone(), root.clone(), true))
            .expect("gap should be a terminal withheld outcome, not an error");
        assert_eq!(report.outcome, TerminalOutcome::Withheld);
        assert_eq!(report.adapter_gaps, 1);
        let store = SegmentStore::open(&root).expect("local store should open");
        assert!(store
            .read(zt_storage::SegmentKey {
                symbol_id: 1,
                interval_ns: 1_000_000,
                start_ns: 1_000_000
            })
            .is_err());
        let _ = fs::remove_file(file);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn explicit_no_flush_and_restart_conflict_preserve_local_history() {
        let root = temporary_root("conflict");
        let file = root.with_extension("frames");
        fs::write(
            &file,
            format!("{}\n{}\n{}\n", frame(1, 1), frame(2, 2), frame(3, 3)),
        )
        .expect("frame fixture should write");
        let (_, no_flush) = execute_import(&request(file.clone(), root.clone(), false))
            .expect("no-flush import should complete");
        assert_eq!(no_flush.outcome, TerminalOutcome::NotRequested);
        let (_, first) = execute_import(&request(file.clone(), root.clone(), true))
            .expect("first flush should persist");
        let metadata = first.persisted.expect("first segment");
        let store = SegmentStore::open(&root).expect("local store should open");
        let (_, original) = store
            .read(metadata.key)
            .expect("persisted history should read");
        let (_, restarted) = execute_import(&request(file.clone(), root.clone(), true))
            .expect("restart collision should report instead of overwrite");
        assert_eq!(restarted.outcome, TerminalOutcome::ExistingSegment);
        let (_, retained) = store
            .read(metadata.key)
            .expect("history should remain readable");
        assert_eq!(retained, original);
        let _ = fs::remove_file(file);
        let _ = fs::remove_dir_all(root);
    }
}
