//! One-shot, local-only adapter between the Rust local scene contract and the
//! native Windows host. It deliberately opens no listener and makes no network,
//! Render, cloud, provider, or broker request.

use std::collections::BTreeMap;
use std::env;
use std::fmt::Write as _;
use std::path::PathBuf;
use std::process::ExitCode;

use zt_core::{
    prepare_local_chart_scene, LocalChartScene, LocalSceneRequest, RenderableLocalScene,
};
use zt_storage::{LocalAvailability, SegmentKey, SegmentStore};

const BRIDGE_SCHEMA_VERSION: u16 = 1;
const REQUIRED_FLAGS: [&str; 8] = [
    "--root",
    "--symbol-id",
    "--interval-ns",
    "--start-ns",
    "--first-bar",
    "--visible-bars",
    "--now-ns",
    "--freshness-budget-ns",
];

#[derive(Clone, Debug, Eq, PartialEq)]
struct BridgeRequest {
    root: PathBuf,
    key: SegmentKey,
    request: LocalSceneRequest,
    now_ns: u64,
    freshness_budget_ns: u64,
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
            eprintln!("zt-local-scene-bridge: {error}");
            ExitCode::from(2)
        }
    }
}

fn parse_request(arguments: impl IntoIterator<Item = String>) -> Result<BridgeRequest, String> {
    let mut values = BTreeMap::new();
    let mut iterator = arguments.into_iter();
    while let Some(flag) = iterator.next() {
        if !REQUIRED_FLAGS.contains(&flag.as_str()) {
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
            return Err(format!("required argument is absent: {flag}"));
        }
    }
    let value = |flag: &str| {
        values
            .get(flag)
            .map(String::as_str)
            .ok_or_else(|| format!("required argument is absent: {flag}"))
    };
    let parse_u64 = |flag: &str| {
        value(flag)?.parse::<u64>().map_err(|_| {
            format!("{flag} must be an unsigned base-10 integer without a sign or suffix")
        })
    };
    let symbol_id = value("--symbol-id")?.parse::<u32>().map_err(|_| {
        "--symbol-id must be an unsigned 32-bit base-10 integer without a sign or suffix".to_owned()
    })?;
    let first_bar = value("--first-bar")?.parse::<usize>().map_err(|_| {
        "--first-bar must be an unsigned platform-sized base-10 integer without a sign or suffix"
            .to_owned()
    })?;
    let visible_bars = value("--visible-bars")?.parse::<usize>().map_err(|_| {
        "--visible-bars must be an unsigned platform-sized base-10 integer without a sign or suffix"
            .to_owned()
    })?;
    let request =
        LocalSceneRequest::new(first_bar, visible_bars).map_err(|error| error.to_string())?;
    Ok(BridgeRequest {
        root: PathBuf::from(value("--root")?),
        key: SegmentKey {
            symbol_id,
            interval_ns: parse_u64("--interval-ns")?,
            start_ns: parse_u64("--start-ns")?,
        },
        request,
        now_ns: parse_u64("--now-ns")?,
        freshness_budget_ns: parse_u64("--freshness-budget-ns")?,
    })
}

fn execute(request: BridgeRequest) -> Result<String, String> {
    // `SegmentStore::open` creates a layout for writers. This one-shot bridge is
    // read-only, so a missing or incomplete root is reported as unavailable
    // without constructing paths or persisting anything.
    if !request.root.join("segments").is_dir() || !request.root.join("metadata").is_dir() {
        return Ok(withheld_json(LocalAvailability::Unavailable, 0));
    }
    let store = SegmentStore::open(&request.root).map_err(|error| error.to_string())?;
    let scene = prepare_local_chart_scene(
        &store,
        request.key,
        request.request,
        request.now_ns,
        request.freshness_budget_ns,
    )
    .map_err(|error| error.to_string())?;
    Ok(match scene {
        LocalChartScene::Renderable(scene) => renderable_json(&scene),
        LocalChartScene::Withheld {
            availability,
            retained_bars,
        } => withheld_json(availability, retained_bars),
    })
}

fn renderable_json(scene: &RenderableLocalScene) -> String {
    let (availability, age_ns) = availability_fields(scene.availability);
    let mut output = format!(
        "{{\"schema_version\":{BRIDGE_SCHEMA_VERSION},\"kind\":\"renderable\",\"availability\":\"{availability}\",\"age_ns\":{age_ns},\"total_bars\":{},\"first_bar\":{},\"candles\":[",
        scene.total_bars, scene.first_bar
    );
    for (index, candle) in scene.candles.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        let _ = write!(
            output,
            "{{\"open_time_ns\":{},\"open_ticks\":{},\"high_ticks\":{},\"low_ticks\":{},\"close_ticks\":{},\"volume\":{}}}",
            candle.open_time_ns,
            candle.open_ticks,
            candle.high_ticks,
            candle.low_ticks,
            candle.close_ticks,
            candle.volume,
        );
    }
    output.push_str("]}");
    output
}

fn withheld_json(availability: LocalAvailability, retained_bars: usize) -> String {
    let (availability, age_ns) = availability_fields(availability);
    format!(
        "{{\"schema_version\":{BRIDGE_SCHEMA_VERSION},\"kind\":\"withheld\",\"availability\":\"{availability}\",\"age_ns\":{age_ns},\"retained_bars\":{retained_bars}}}"
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

#[cfg(test)]
mod tests {
    use super::*;

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
            "--first-bar".to_owned(),
            "0".to_owned(),
            "--visible-bars".to_owned(),
            "1".to_owned(),
            "--now-ns".to_owned(),
            "100".to_owned(),
            "--freshness-budget-ns".to_owned(),
            "10".to_owned(),
        ]
    }

    #[test]
    fn rejects_missing_duplicate_and_unsupported_arguments() {
        assert!(parse_request(Vec::<String>::new()).is_err());
        let mut duplicate = required_arguments();
        duplicate.extend(["--visible-bars".to_owned(), "2".to_owned()]);
        assert!(parse_request(duplicate).is_err());
        let mut unsupported = required_arguments();
        unsupported.extend(["--provider".to_owned(), "fallback".to_owned()]);
        assert!(parse_request(unsupported).is_err());
    }

    #[test]
    fn missing_local_layout_returns_versioned_unavailable_json() {
        let request = BridgeRequest {
            root: std::env::temp_dir().join("zt-local-scene-bridge-absent-root"),
            key: SegmentKey {
                symbol_id: 9,
                interval_ns: 1,
                start_ns: 0,
            },
            request: LocalSceneRequest::new(0, 1).expect("one candle request"),
            now_ns: 0,
            freshness_budget_ns: 0,
        };
        assert_eq!(
            execute(request).expect("missing local layout should fail closed in JSON"),
            "{\"schema_version\":1,\"kind\":\"withheld\",\"availability\":\"unavailable\",\"age_ns\":0,\"retained_bars\":0}"
        );
    }

    #[test]
    fn json_output_keeps_status_and_integer_candle_values_explicit() {
        assert_eq!(
            withheld_json(LocalAvailability::Stale { age_ns: 23 }, 7),
            "{\"schema_version\":1,\"kind\":\"withheld\",\"availability\":\"stale\",\"age_ns\":23,\"retained_bars\":7}"
        );
    }
}
