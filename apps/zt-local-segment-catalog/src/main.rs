//! Internal one-shot bounded local segment catalog sidecar for the native Windows host.
//!
//! It reads only an explicit local SegmentStore and deliberately opens no listener,
//! provider, Render, cloud, account, broker, or strategy execution path.

use std::collections::BTreeMap;
use std::env;
use std::fmt::Write as _;
use std::path::PathBuf;
use std::process::ExitCode;

use zt_storage::{
    LocalSegmentCatalog, SegmentMetadata, SegmentStore, StorageError,
    MAXIMUM_LOCAL_SEGMENT_CATALOG_ENTRIES,
};

const COMMAND_SCHEMA_VERSION: u16 = 1;
const REQUIRED_FLAGS: [&str; 4] = [
    "--root",
    "--symbol-id",
    "--interval-ns",
    "--maximum-entries",
];

#[derive(Clone, Debug, Eq, PartialEq)]
struct CommandRequest {
    root: PathBuf,
    symbol_id: u32,
    interval_ns: u64,
    maximum_entries: usize,
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
            eprintln!("zt-local-segment-catalog: {error}");
            ExitCode::from(2)
        }
    }
}

fn parse_request(arguments: impl IntoIterator<Item = String>) -> Result<CommandRequest, String> {
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
    let maximum_entries = value("--maximum-entries")?.parse::<usize>().map_err(|_| {
        "--maximum-entries must be an unsigned platform-sized base-10 integer without a sign or suffix"
            .to_owned()
    })?;
    if maximum_entries == 0 || maximum_entries > MAXIMUM_LOCAL_SEGMENT_CATALOG_ENTRIES {
        return Err(format!(
            "--maximum-entries must be within 1..={MAXIMUM_LOCAL_SEGMENT_CATALOG_ENTRIES}"
        ));
    }
    Ok(CommandRequest {
        root: PathBuf::from(value("--root")?),
        symbol_id,
        interval_ns,
        maximum_entries,
    })
}

fn execute(request: CommandRequest) -> Result<String, StorageError> {
    // SegmentStore::open creates a writer layout. This command stays read-only,
    // so missing/incomplete roots become a versioned unavailable result first.
    if !request.root.join("segments").is_dir() || !request.root.join("metadata").is_dir() {
        return Ok(unavailable_json());
    }
    let store = SegmentStore::open(&request.root)?;
    let catalog = store.catalog(
        request.symbol_id,
        request.interval_ns,
        request.maximum_entries,
    )?;
    Ok(catalog_json(&catalog))
}

fn unavailable_json() -> String {
    format!(
        "{{\"schema_version\":{COMMAND_SCHEMA_VERSION},\"kind\":\"catalog\",\"layout\":\"unavailable\",\"truncated\":false,\"malformed_metadata_entries\":0,\"missing_payload_entries\":0,\"corrupt_payload_entries\":0,\"entries\":[]}}"
    )
}

fn catalog_json(catalog: &LocalSegmentCatalog) -> String {
    let mut output = format!(
        "{{\"schema_version\":{COMMAND_SCHEMA_VERSION},\"kind\":\"catalog\",\"layout\":\"available\",\"truncated\":{},\"malformed_metadata_entries\":{},\"missing_payload_entries\":{},\"corrupt_payload_entries\":{},\"entries\":[",
        catalog.truncated,
        catalog.malformed_metadata_entries,
        catalog.missing_payload_entries,
        catalog.corrupt_payload_entries,
    );
    for (index, entry) in catalog.entries.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        let _ = write!(
            output,
            "{{\"start_ns\":{},\"bytes\":{},\"last_access\":{},\"data_status\":\"{}\"}}",
            entry.key.start_ns,
            entry.bytes,
            entry.last_access,
            data_status_label(*entry),
        );
    }
    output.push_str("]}");
    output
}

fn data_status_label(entry: SegmentMetadata) -> &'static str {
    match entry.data_status {
        zt_protocol::DataStatus::Live => "live",
        zt_protocol::DataStatus::Stale => "stale",
        zt_protocol::DataStatus::Gap => "gap",
        zt_protocol::DataStatus::Unavailable => "unavailable",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zt_protocol::DataStatus;
    use zt_storage::{SegmentKey, SegmentMetadata};

    fn required_arguments() -> Vec<String> {
        vec![
            "--root".to_owned(),
            "C:\\local-cache".to_owned(),
            "--symbol-id".to_owned(),
            "9".to_owned(),
            "--interval-ns".to_owned(),
            "1000000000".to_owned(),
            "--maximum-entries".to_owned(),
            "4".to_owned(),
        ]
    }

    #[test]
    fn strict_arguments_reject_missing_duplicate_unsupported_and_unbounded_requests() {
        assert!(parse_request(Vec::<String>::new()).is_err());
        let mut duplicate = required_arguments();
        duplicate.extend(["--maximum-entries".to_owned(), "2".to_owned()]);
        assert!(parse_request(duplicate).is_err());
        let mut unsupported = required_arguments();
        unsupported.extend(["--provider".to_owned(), "fallback".to_owned()]);
        assert!(parse_request(unsupported).is_err());
        let mut oversized = required_arguments();
        let maximum_index = oversized
            .iter()
            .position(|value| value == "--maximum-entries")
            .expect("maximum argument exists");
        oversized[maximum_index + 1] = (MAXIMUM_LOCAL_SEGMENT_CATALOG_ENTRIES + 1).to_string();
        assert!(parse_request(oversized).is_err());
    }

    #[test]
    fn missing_local_layout_returns_versioned_unavailable_catalog() {
        let request = CommandRequest {
            root: std::env::temp_dir().join("zt-local-segment-catalog-absent-root"),
            symbol_id: 9,
            interval_ns: 1,
            maximum_entries: 1,
        };
        assert_eq!(
            execute(request).expect("missing local layout must fail closed in JSON"),
            "{\"schema_version\":1,\"kind\":\"catalog\",\"layout\":\"unavailable\",\"truncated\":false,\"malformed_metadata_entries\":0,\"missing_payload_entries\":0,\"corrupt_payload_entries\":0,\"entries\":[]}"
        );
    }

    #[test]
    fn catalog_json_keeps_only_aggregate_metadata_fields_explicit() {
        let catalog = LocalSegmentCatalog {
            entries: vec![SegmentMetadata {
                key: SegmentKey {
                    symbol_id: 9,
                    interval_ns: 1,
                    start_ns: 4,
                },
                bytes: 8,
                last_access: 12,
                data_status: DataStatus::Live,
                content_hash: 99,
            }],
            truncated: true,
            malformed_metadata_entries: 1,
            missing_payload_entries: 2,
            corrupt_payload_entries: 3,
        };
        assert_eq!(
            catalog_json(&catalog),
            "{\"schema_version\":1,\"kind\":\"catalog\",\"layout\":\"available\",\"truncated\":true,\"malformed_metadata_entries\":1,\"missing_payload_entries\":2,\"corrupt_payload_entries\":3,\"entries\":[{\"start_ns\":4,\"bytes\":8,\"last_access\":12,\"data_status\":\"live\"}]}"
        );
    }
}
