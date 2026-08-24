//! Internal one-shot bounded local Monte Carlo sidecar for the native Windows host.
//!
//! It reads only one explicit integrity-checked local segment and deliberately
//! opens no listener, provider, Render, cloud, account, broker, or strategy-code path.

use std::collections::BTreeMap;
use std::env;
use std::path::PathBuf;
use std::process::ExitCode;

use zt_core::{
    load_contiguous_local_history_research_source, run_local_monte_carlo,
    LocalHistoryResearchRequest, LocalHistoryResearchSource, LocalHistoryWithheldReason,
    LocalMonteCarloOutcome, LocalMonteCarloRequest, LocalMonteCarloResult, MonteCarloWithheld,
    MonteCarloWithheldReason, MAXIMUM_LOCAL_HISTORY_RESEARCH_SEGMENTS,
};
use zt_storage::{LocalAvailability, SegmentKey, SegmentStore};

const COMMAND_SCHEMA_VERSION: u16 = 1;
const REQUIRED_FLAGS: [&str; 9] = [
    "--root",
    "--symbol-id",
    "--interval-ns",
    "--start-ns",
    "--now-ns",
    "--freshness-budget-ns",
    "--simulations",
    "--horizon-bars",
    "--seed",
];
const HISTORY_SEGMENTS_FLAG: &str = "--history-segments";

#[derive(Clone, Debug, Eq, PartialEq)]
struct CommandRequest {
    root: PathBuf,
    key: SegmentKey,
    now_ns: u64,
    freshness_budget_ns: u64,
    simulation: LocalMonteCarloRequest,
    history_segments: usize,
}

fn main() -> ExitCode {
    match parse_request(env::args().skip(1))
        .and_then(|request| execute(request).map_err(|error| error.to_string()))
    {
        Ok(output) => {
            println!("{output}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("zt-local-monte-carlo: {error}");
            ExitCode::from(2)
        }
    }
}

fn parse_request(arguments: impl IntoIterator<Item = String>) -> Result<CommandRequest, String> {
    let mut values = BTreeMap::new();
    let mut iterator = arguments.into_iter();
    while let Some(flag) = iterator.next() {
        if !REQUIRED_FLAGS.contains(&flag.as_str()) && flag != HISTORY_SEGMENTS_FLAG {
            return Err(format!("unsupported argument: {flag}"));
        }
        let Some(value) = iterator.next() else {
            return Err(format!("missing value for {flag}"));
        };
        if values.insert(flag.clone(), value).is_some() {
            return Err(format!("duplicate argument: {flag}"));
        }
    }
    for flag in REQUIRED_FLAGS {
        if !values.contains_key(flag) {
            return Err(format!("missing required argument: {flag}"));
        }
    }
    let value = |flag: &str| {
        values
            .get(flag)
            .map(String::as_str)
            .ok_or_else(|| format!("missing required argument: {flag}"))
    };
    let parse_u64 = |flag: &str| {
        value(flag)?.parse::<u64>().map_err(|_| {
            format!("{flag} must be an unsigned base-10 integer without a sign or suffix")
        })
    };
    let symbol_id = value("--symbol-id")?.parse::<u32>().map_err(|_| {
        "--symbol-id must be an unsigned 32-bit base-10 integer without a sign or suffix".to_owned()
    })?;
    let interval_ns = parse_u64("--interval-ns")?;
    if interval_ns == 0 {
        return Err("--interval-ns must be non-zero".to_owned());
    }
    let history_segments = values
        .get(HISTORY_SEGMENTS_FLAG)
        .map(String::as_str)
        .map(|value| {
            value.parse::<usize>().map_err(|_| {
                "--history-segments must be an unsigned platform-sized base-10 integer without a sign or suffix"
                    .to_owned()
            })
        })
        .transpose()?
        .unwrap_or(1);
    if history_segments == 0 || history_segments > MAXIMUM_LOCAL_HISTORY_RESEARCH_SEGMENTS {
        return Err(format!(
            "--history-segments must be within 1..={MAXIMUM_LOCAL_HISTORY_RESEARCH_SEGMENTS}"
        ));
    }
    let simulation = LocalMonteCarloRequest::new(
        value("--simulations")?.parse::<usize>().map_err(|_| {
            "--simulations must be an unsigned platform-sized base-10 integer without a sign or suffix"
                .to_owned()
        })?,
        value("--horizon-bars")?.parse::<usize>().map_err(|_| {
            "--horizon-bars must be an unsigned platform-sized base-10 integer without a sign or suffix"
                .to_owned()
        })?,
        parse_u64("--seed")?,
    )
    .map_err(|error| error.to_string())?;
    Ok(CommandRequest {
        root: PathBuf::from(value("--root")?),
        key: SegmentKey {
            symbol_id,
            interval_ns,
            start_ns: parse_u64("--start-ns")?,
        },
        now_ns: parse_u64("--now-ns")?,
        freshness_budget_ns: parse_u64("--freshness-budget-ns")?,
        simulation,
        history_segments,
    })
}

fn execute(request: CommandRequest) -> Result<String, String> {
    // SegmentStore::open creates a writer layout. This command is read-only, so
    // a missing/incomplete root is truthfully unavailable without creating it.
    if !request.root.join("segments").is_dir() || !request.root.join("metadata").is_dir() {
        return Ok(withheld_json(
            LocalAvailability::Unavailable,
            0,
            "source_unavailable",
        ));
    }
    let store = SegmentStore::open(&request.root).map_err(|error| error.to_string())?;
    let history_request = LocalHistoryResearchRequest::new(request.key, request.history_segments)
        .map_err(|error| error.to_string())?;
    match load_contiguous_local_history_research_source(
        &store,
        history_request,
        request.now_ns,
        request.freshness_budget_ns,
    )
    .map_err(|error| error.to_string())?
    {
        LocalHistoryResearchSource::Withheld {
            availability,
            retained_bars,
            reason,
            ..
        } => Ok(withheld_json(
            availability,
            retained_bars,
            local_history_withheld_reason(reason),
        )),
        LocalHistoryResearchSource::Available {
            availability,
            source_segments,
            bars,
        } => match run_local_monte_carlo(&bars, request.simulation)
            .map_err(|error| error.to_string())?
        {
            LocalMonteCarloOutcome::Complete(result) => {
                Ok(complete_json(availability, source_segments, result))
            }
            LocalMonteCarloOutcome::Withheld(withheld) => Ok(withheld_json(
                availability,
                withheld.inspected_bars,
                monte_carlo_withheld_reason(withheld),
            )),
        },
    }
}

fn complete_json(
    availability: LocalAvailability,
    source_segments: usize,
    result: LocalMonteCarloResult,
) -> String {
    let (availability, age_ns) = availability_fields(availability);
    format!(
        "{{\"schema_version\":{},\"kind\":\"complete\",\"availability\":\"{}\",\"age_ns\":{},\"algorithm_version\":{},\"seed\":{},\"source_segments\":{},\"source_bars\":{},\"source_returns\":{},\"simulations\":{},\"horizon_bars\":{},\"minimum_return_bps\":{},\"p05_return_bps\":{},\"median_return_bps\":{},\"p95_return_bps\":{},\"maximum_return_bps\":{},\"mean_return_bps\":{}}}",
        COMMAND_SCHEMA_VERSION,
        availability,
        age_ns,
        result.algorithm_version,
        result.seed,
        source_segments,
        result.source_bars,
        result.source_returns,
        result.simulations,
        result.horizon_bars,
        result.minimum_return_bps,
        result.p05_return_bps,
        result.median_return_bps,
        result.p95_return_bps,
        result.maximum_return_bps,
        result.mean_return_bps,
    )
}

fn withheld_json(availability: LocalAvailability, retained_bars: usize, reason: &str) -> String {
    let (availability, age_ns) = availability_fields(availability);
    format!(
        "{{\"schema_version\":{COMMAND_SCHEMA_VERSION},\"kind\":\"withheld\",\"availability\":\"{availability}\",\"age_ns\":{age_ns},\"retained_bars\":{retained_bars},\"reason\":\"{reason}\"}}"
    )
}

fn availability_fields(availability: LocalAvailability) -> (&'static str, u64) {
    match availability {
        LocalAvailability::Live => ("live", 0),
        LocalAvailability::Cached { age_ns } => ("cached", age_ns),
        LocalAvailability::Stale { age_ns } => ("stale", age_ns),
        LocalAvailability::Gap => ("gap", 0),
        LocalAvailability::Unavailable => ("unavailable", 0),
        LocalAvailability::Corrupt => ("corrupt", 0),
    }
}

fn local_history_withheld_reason(reason: LocalHistoryWithheldReason) -> &'static str {
    match reason {
        LocalHistoryWithheldReason::CatalogTruncated => "history_catalog_truncated",
        LocalHistoryWithheldReason::StartNotCataloged => "history_start_not_cataloged",
        LocalHistoryWithheldReason::InsufficientCatalogedSegments => {
            "insufficient_cataloged_segments"
        }
        LocalHistoryWithheldReason::SegmentSourceWithheld => "history_segment_source_withheld",
        LocalHistoryWithheldReason::CrossSegmentGap => "cross_segment_gap",
        LocalHistoryWithheldReason::SourceBarBoundExceeded => "history_source_bar_bound",
    }
}

fn monte_carlo_withheld_reason(withheld: MonteCarloWithheld) -> &'static str {
    match withheld.reason {
        MonteCarloWithheldReason::InsufficientSourceBars => "insufficient_source_bars",
        MonteCarloWithheldReason::DataStatus(_) => "degraded_bar_status",
        MonteCarloWithheldReason::MixedStream => "mixed_stream",
        MonteCarloWithheldReason::NonContiguous { .. } => "non_contiguous_source",
        MonteCarloWithheldReason::InvalidInterval => "invalid_interval",
        MonteCarloWithheldReason::InvalidClose => "invalid_close",
        MonteCarloWithheldReason::NumericOverflow => "numeric_overflow",
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use zt_core::encode_local_bar_segment;
    use zt_protocol::{Bar, DataStatus};

    fn required_arguments() -> Vec<String> {
        vec![
            "--root".to_owned(),
            "C:\\local-cache".to_owned(),
            "--symbol-id".to_owned(),
            "9".to_owned(),
            "--interval-ns".to_owned(),
            "1000000000".to_owned(),
            "--start-ns".to_owned(),
            "0".to_owned(),
            "--now-ns".to_owned(),
            "100".to_owned(),
            "--freshness-budget-ns".to_owned(),
            "10".to_owned(),
            "--simulations".to_owned(),
            "4".to_owned(),
            "--horizon-bars".to_owned(),
            "2".to_owned(),
            "--seed".to_owned(),
            "7".to_owned(),
        ]
    }

    #[test]
    fn strict_arguments_reject_missing_duplicate_unsupported_and_unbounded_requests() {
        assert!(parse_request(Vec::<String>::new()).is_err());
        let mut duplicate = required_arguments();
        duplicate.extend(["--seed".to_owned(), "9".to_owned()]);
        assert!(parse_request(duplicate).is_err());
        let mut unsupported = required_arguments();
        unsupported.extend(["--provider".to_owned(), "fallback".to_owned()]);
        assert!(parse_request(unsupported).is_err());
        let mut zero_seed = required_arguments();
        let seed_index = zero_seed
            .iter()
            .position(|value| value == "--seed")
            .expect("seed argument exists");
        zero_seed[seed_index + 1] = "0".to_owned();
        assert!(parse_request(zero_seed).is_err());
    }

    #[test]
    fn missing_local_layout_returns_versioned_unavailable_json() {
        let request = CommandRequest {
            root: std::env::temp_dir().join("zt-local-monte-carlo-absent-root"),
            key: SegmentKey {
                symbol_id: 9,
                interval_ns: 1,
                start_ns: 0,
            },
            now_ns: 0,
            freshness_budget_ns: 0,
            simulation: LocalMonteCarloRequest::new(4, 2, 7).expect("bounded request"),
            history_segments: 1,
        };
        assert_eq!(
            execute(request).expect("missing local layout must fail closed in JSON"),
            "{\"schema_version\":1,\"kind\":\"withheld\",\"availability\":\"unavailable\",\"age_ns\":0,\"retained_bars\":0,\"reason\":\"source_unavailable\"}"
        );
    }

    #[test]
    fn integrity_checked_local_segment_produces_a_complete_bounded_result() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after epoch")
            .as_nanos();
        let root: PathBuf = std::env::temp_dir().join(format!("zt-local-monte-carlo-{nonce}"));
        let key = SegmentKey {
            symbol_id: 9,
            interval_ns: 1,
            start_ns: 0,
        };
        let bars = vec![
            Bar {
                symbol_id: 9,
                open_time_ns: 0,
                interval_ns: 1,
                open_ticks: 100,
                high_ticks: 100,
                low_ticks: 100,
                close_ticks: 100,
                volume: 1,
                last_sequence: 1,
                data_status: DataStatus::Live,
            },
            Bar {
                symbol_id: 9,
                open_time_ns: 1,
                interval_ns: 1,
                open_ticks: 110,
                high_ticks: 110,
                low_ticks: 110,
                close_ticks: 110,
                volume: 1,
                last_sequence: 2,
                data_status: DataStatus::Live,
            },
            Bar {
                symbol_id: 9,
                open_time_ns: 2,
                interval_ns: 1,
                open_ticks: 99,
                high_ticks: 99,
                low_ticks: 99,
                close_ticks: 99,
                volume: 1,
                last_sequence: 3,
                data_status: DataStatus::Live,
            },
        ];
        let store = SegmentStore::open(&root).expect("local store must open");
        let payload = encode_local_bar_segment(key, 100, &bars).expect("valid local payload");
        store
            .write(key, &payload, 1, DataStatus::Live)
            .expect("immutable local segment must persist");
        let output = execute(CommandRequest {
            root: root.clone(),
            key,
            now_ns: 100,
            freshness_budget_ns: 10,
            simulation: LocalMonteCarloRequest::new(4, 2, 7).expect("bounded request"),
            history_segments: 1,
        })
        .expect("verified local research must complete");
        assert!(output.contains("\"kind\":\"complete\""));
        assert!(output.contains("\"source_segments\":1"));
        assert!(output.contains("\"source_bars\":3"));
        assert!(output.contains("\"simulations\":4"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn explicit_contiguous_history_segments_produce_a_bounded_complete_result() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after epoch")
            .as_nanos();
        let root: PathBuf =
            std::env::temp_dir().join(format!("zt-local-monte-carlo-history-{nonce}"));
        let store = SegmentStore::open(&root).expect("local store must open");
        for (start_ns, closes) in [(0_u64, [100_i64, 110_i64, 105_i64]), (3, [105, 115, 120])] {
            let key = SegmentKey {
                symbol_id: 9,
                interval_ns: 1,
                start_ns,
            };
            let bars: Vec<_> = closes
                .into_iter()
                .enumerate()
                .map(|(index, close_ticks)| Bar {
                    symbol_id: 9,
                    open_time_ns: start_ns + u64::try_from(index).expect("small index"),
                    interval_ns: 1,
                    open_ticks: close_ticks,
                    high_ticks: close_ticks,
                    low_ticks: close_ticks,
                    close_ticks,
                    volume: 1,
                    last_sequence: u64::try_from(index).expect("small index") + 1,
                    data_status: DataStatus::Live,
                })
                .collect();
            let payload = encode_local_bar_segment(key, 100, &bars).expect("valid local payload");
            store
                .write(key, &payload, 1, DataStatus::Live)
                .expect("immutable local segment must persist");
        }
        let output = execute(CommandRequest {
            root: root.clone(),
            key: SegmentKey {
                symbol_id: 9,
                interval_ns: 1,
                start_ns: 0,
            },
            now_ns: 100,
            freshness_budget_ns: 10,
            simulation: LocalMonteCarloRequest::new(8, 2, 7).expect("bounded request"),
            history_segments: 2,
        })
        .expect("contiguous local history research must complete");
        assert!(output.contains("\"kind\":\"complete\""));
        assert!(output.contains("\"source_segments\":2"));
        assert!(output.contains("\"source_bars\":6"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cross_segment_gap_is_withheld_without_partial_monte_carlo_output() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after epoch")
            .as_nanos();
        let root: PathBuf = std::env::temp_dir().join(format!("zt-local-monte-carlo-gap-{nonce}"));
        let store = SegmentStore::open(&root).expect("local store must open");
        for start_ns in [0_u64, 4] {
            let key = SegmentKey {
                symbol_id: 9,
                interval_ns: 1,
                start_ns,
            };
            let bars: Vec<_> = (0..2_u64)
                .map(|index| Bar {
                    symbol_id: 9,
                    open_time_ns: start_ns + index,
                    interval_ns: 1,
                    open_ticks: 100,
                    high_ticks: 100,
                    low_ticks: 100,
                    close_ticks: 100,
                    volume: 1,
                    last_sequence: index + 1,
                    data_status: DataStatus::Live,
                })
                .collect();
            let payload = encode_local_bar_segment(key, 100, &bars).expect("valid local payload");
            store
                .write(key, &payload, 1, DataStatus::Live)
                .expect("immutable local segment must persist");
        }
        let output = execute(CommandRequest {
            root: root.clone(),
            key: SegmentKey {
                symbol_id: 9,
                interval_ns: 1,
                start_ns: 0,
            },
            now_ns: 100,
            freshness_budget_ns: 10,
            simulation: LocalMonteCarloRequest::new(8, 2, 7).expect("bounded request"),
            history_segments: 2,
        })
        .expect("gap must be represented without a result");
        assert!(output.contains("\"kind\":\"withheld\""));
        assert!(output.contains("\"reason\":\"cross_segment_gap\""));
        assert!(!output.contains("\"source_segments\""));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn complete_json_keeps_algorithm_and_integer_distribution_fields_explicit() {
        let result = LocalMonteCarloResult {
            algorithm_version: 1,
            seed: 7,
            source_bars: 3,
            source_returns: 2,
            simulations: 4,
            horizon_bars: 2,
            minimum_return_bps: -10,
            p05_return_bps: -5,
            median_return_bps: 0,
            p95_return_bps: 5,
            maximum_return_bps: 10,
            mean_return_bps: 1,
        };
        assert_eq!(
            complete_json(LocalAvailability::Cached { age_ns: 23 }, 2, result),
            "{\"schema_version\":1,\"kind\":\"complete\",\"availability\":\"cached\",\"age_ns\":23,\"algorithm_version\":1,\"seed\":7,\"source_segments\":2,\"source_bars\":3,\"source_returns\":2,\"simulations\":4,\"horizon_bars\":2,\"minimum_return_bps\":-10,\"p05_return_bps\":-5,\"median_return_bps\":0,\"p95_return_bps\":5,\"maximum_return_bps\":10,\"mean_return_bps\":1}"
        );
    }
}
