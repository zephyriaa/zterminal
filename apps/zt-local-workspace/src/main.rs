//! Internal one-shot local workspace journal command for the native Windows host.
//!
//! It reads and writes only an explicit local workspace journal. It deliberately
//! opens no provider, Render, cloud, account, broker, or strategy execution path.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;

use zt_storage::{WorkspaceJournal, WorkspaceJournalBudget, WorkspaceSnapshot, WorkspaceSyncState};

const COMMAND_SCHEMA_VERSION: u16 = 1;
const MAXIMUM_WORKSPACE_PAYLOAD_BYTES: u64 = 64 * 1024;
const MINIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES: u64 = 64 * 1024;
const MAXIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES: u64 = 4 * 1024 * 1024;
const ALL_FLAGS: [&str; 7] = [
    "--operation",
    "--root",
    "--workspace-id",
    "--revision",
    "--saved-at-ns",
    "--payload-file",
    "--journal-budget-bytes",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Operation {
    Save,
    Read,
    Compact,
}

impl Operation {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "save" => Ok(Self::Save),
            "read" => Ok(Self::Read),
            "compact" => Ok(Self::Compact),
            _ => Err("--operation must be save, read, or compact".to_owned()),
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Save => "save",
            Self::Read => "read",
            Self::Compact => "compact",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct CommandRequest {
    operation: Operation,
    root: PathBuf,
    workspace_id: Option<u64>,
    revision: Option<u64>,
    saved_at_ns: Option<u64>,
    payload_file: Option<PathBuf>,
    journal_budget_bytes: u64,
}

fn main() -> ExitCode {
    match parse_request(env::args().skip(1)).and_then(execute) {
        Ok(output) => {
            println!("{output}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("zt-local-workspace: {error}");
            ExitCode::from(2)
        }
    }
}

fn parse_request(arguments: impl IntoIterator<Item = String>) -> Result<CommandRequest, String> {
    let mut values = BTreeMap::new();
    let mut iterator = arguments.into_iter();
    while let Some(flag) = iterator.next() {
        if !ALL_FLAGS.contains(&flag.as_str()) {
            return Err(format!("unsupported argument: {flag}"));
        }
        let Some(value) = iterator.next() else {
            return Err(format!("missing value for {flag}"));
        };
        if values.insert(flag.clone(), value).is_some() {
            return Err(format!("duplicate argument: {flag}"));
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
    let operation = Operation::parse(value("--operation")?)?;
    let root = PathBuf::from(value("--root")?);
    if root.as_os_str().is_empty() {
        return Err("--root must not be empty".to_owned());
    }
    let journal_budget_bytes = parse_u64("--journal-budget-bytes")?;
    if !(MINIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES..=MAXIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES)
        .contains(&journal_budget_bytes)
    {
        return Err(format!(
            "--journal-budget-bytes must be within {MINIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES}..={MAXIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES}"
        ));
    }
    let workspace_id = values
        .get("--workspace-id")
        .map(|_| parse_u64("--workspace-id"))
        .transpose()?;
    let revision = values
        .get("--revision")
        .map(|_| parse_u64("--revision"))
        .transpose()?;
    let saved_at_ns = values
        .get("--saved-at-ns")
        .map(|_| parse_u64("--saved-at-ns"))
        .transpose()?;
    let payload_file = values.get("--payload-file").map(PathBuf::from);
    match operation {
        Operation::Save => {
            for (flag, present) in [
                ("--workspace-id", workspace_id.is_some()),
                ("--revision", revision.is_some()),
                ("--saved-at-ns", saved_at_ns.is_some()),
                ("--payload-file", payload_file.is_some()),
            ] {
                if !present {
                    return Err(format!("missing required argument: {flag}"));
                }
            }
            if workspace_id == Some(0) || revision == Some(0) {
                return Err("--workspace-id and --revision must be non-zero".to_owned());
            }
        }
        Operation::Read => {
            if revision.is_some() || saved_at_ns.is_some() || payload_file.is_some() {
                return Err(
                    "read accepts only --workspace-id in addition to shared arguments".to_owned(),
                );
            }
            if workspace_id.is_none() || workspace_id == Some(0) {
                return Err("read requires a non-zero --workspace-id".to_owned());
            }
        }
        Operation::Compact => {
            if workspace_id.is_some()
                || revision.is_some()
                || saved_at_ns.is_some()
                || payload_file.is_some()
            {
                return Err("compact accepts only shared arguments".to_owned());
            }
        }
    }
    Ok(CommandRequest {
        operation,
        root,
        workspace_id,
        revision,
        saved_at_ns,
        payload_file,
        journal_budget_bytes,
    })
}

fn execute(request: CommandRequest) -> Result<String, String> {
    let budget = WorkspaceJournalBudget::new(request.journal_budget_bytes);
    match request.operation {
        Operation::Save => {
            let payload_path = request
                .payload_file
                .as_ref()
                .ok_or_else(|| "save payload file was absent after parsing".to_owned())?;
            let metadata = fs::metadata(payload_path)
                .map_err(|error| format!("read local workspace payload metadata: {error}"))?;
            if !metadata.is_file() || metadata.len() > MAXIMUM_WORKSPACE_PAYLOAD_BYTES {
                return Err(format!(
                    "--payload-file must be a regular local file no larger than {MAXIMUM_WORKSPACE_PAYLOAD_BYTES} bytes"
                ));
            }
            let payload = fs::read(payload_path)
                .map_err(|error| format!("read local workspace payload: {error}"))?;
            let journal =
                WorkspaceJournal::open(&request.root, budget).map_err(|error| error.to_string())?;
            let snapshot = WorkspaceSnapshot {
                workspace_id: request
                    .workspace_id
                    .expect("save parse requires workspace id"),
                revision: request.revision.expect("save parse requires revision"),
                saved_at_ns: request.saved_at_ns.expect("save parse requires save time"),
                sync_state: WorkspaceSyncState::LocalOnly,
                payload,
            };
            journal
                .append(&snapshot)
                .map_err(|error| error.to_string())?;
            Ok(save_json(
                snapshot.workspace_id,
                snapshot.revision,
                snapshot.payload.len(),
            ))
        }
        Operation::Read => {
            let workspace_id = request
                .workspace_id
                .expect("read parse requires workspace id");
            if !request.root.is_dir() {
                return Ok(read_json(workspace_id, None));
            }
            let journal =
                WorkspaceJournal::open(&request.root, budget).map_err(|error| error.to_string())?;
            let latest = journal.latest().map_err(|error| error.to_string())?;
            Ok(read_json(workspace_id, latest.get(&workspace_id)))
        }
        Operation::Compact => {
            let journal =
                WorkspaceJournal::open(&request.root, budget).map_err(|error| error.to_string())?;
            journal.compact().map_err(|error| error.to_string())?;
            Ok(format!(
                "{{\"schema_version\":{COMMAND_SCHEMA_VERSION},\"kind\":\"workspace\",\"operation\":\"{}\",\"network_opened\":false,\"compacted\":true}}",
                request.operation.label()
            ))
        }
    }
}

fn save_json(workspace_id: u64, revision: u64, payload_bytes: usize) -> String {
    format!(
        "{{\"schema_version\":{COMMAND_SCHEMA_VERSION},\"kind\":\"workspace\",\"operation\":\"save\",\"network_opened\":false,\"workspace_id\":{workspace_id},\"revision\":{revision},\"sync_state\":\"local_only\",\"payload_bytes\":{payload_bytes}}}"
    )
}

fn read_json(workspace_id: u64, snapshot: Option<&WorkspaceSnapshot>) -> String {
    let Some(snapshot) = snapshot else {
        return format!(
            "{{\"schema_version\":{COMMAND_SCHEMA_VERSION},\"kind\":\"workspace\",\"operation\":\"read\",\"network_opened\":false,\"workspace_id\":{workspace_id},\"found\":false}}"
        );
    };
    format!(
        "{{\"schema_version\":{COMMAND_SCHEMA_VERSION},\"kind\":\"workspace\",\"operation\":\"read\",\"network_opened\":false,\"workspace_id\":{workspace_id},\"found\":true,\"revision\":{},\"saved_at_ns\":{},\"sync_state\":\"{}\",\"payload_bytes\":{}}}",
        snapshot.revision,
        snapshot.saved_at_ns,
        sync_state_label(snapshot.sync_state),
        snapshot.payload.len(),
    )
}

fn sync_state_label(sync_state: WorkspaceSyncState) -> &'static str {
    match sync_state {
        WorkspaceSyncState::LocalOnly => "local_only",
        WorkspaceSyncState::Queued => "queued",
        WorkspaceSyncState::Synced => "synced",
        WorkspaceSyncState::Conflict => "conflict",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("zt-local-workspace-{label}-{nonce}"))
    }

    fn save_arguments(root: &std::path::Path, payload_file: &std::path::Path) -> Vec<String> {
        vec![
            "--operation".to_owned(),
            "save".to_owned(),
            "--root".to_owned(),
            root.display().to_string(),
            "--workspace-id".to_owned(),
            "7".to_owned(),
            "--revision".to_owned(),
            "1".to_owned(),
            "--saved-at-ns".to_owned(),
            "9".to_owned(),
            "--payload-file".to_owned(),
            payload_file.display().to_string(),
            "--journal-budget-bytes".to_owned(),
            MINIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES.to_string(),
        ]
    }

    #[test]
    fn strict_arguments_reject_missing_duplicate_unsupported_and_cloud_state_requests() {
        assert!(parse_request(Vec::<String>::new()).is_err());
        let root = temporary_root("arguments");
        let payload = root.join("payload.bin");
        let mut duplicate = save_arguments(&root, &payload);
        duplicate.extend(["--revision".to_owned(), "2".to_owned()]);
        assert!(parse_request(duplicate).is_err());
        let mut unsupported = save_arguments(&root, &payload);
        unsupported.extend(["--sync-state".to_owned(), "synced".to_owned()]);
        assert!(parse_request(unsupported).is_err());
        let compact = vec![
            "--operation".to_owned(),
            "compact".to_owned(),
            "--root".to_owned(),
            root.display().to_string(),
            "--workspace-id".to_owned(),
            "7".to_owned(),
            "--journal-budget-bytes".to_owned(),
            MINIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES.to_string(),
        ];
        assert!(parse_request(compact).is_err());
    }

    #[test]
    fn local_save_and_read_emit_only_aggregate_metadata() {
        let root = temporary_root("save-read");
        fs::create_dir_all(&root).expect("test root should exist");
        let payload = root.join("workspace.bin");
        fs::write(&payload, b"opaque-local-layout").expect("payload should write");
        let save = parse_request(save_arguments(&root, &payload)).expect("save should parse");
        assert_eq!(
            execute(save).expect("save should persist locally"),
            "{\"schema_version\":1,\"kind\":\"workspace\",\"operation\":\"save\",\"network_opened\":false,\"workspace_id\":7,\"revision\":1,\"sync_state\":\"local_only\",\"payload_bytes\":19}"
        );
        let read = parse_request(vec![
            "--operation".to_owned(),
            "read".to_owned(),
            "--root".to_owned(),
            root.display().to_string(),
            "--workspace-id".to_owned(),
            "7".to_owned(),
            "--journal-budget-bytes".to_owned(),
            MINIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES.to_string(),
        ])
        .expect("read should parse");
        let output = execute(read).expect("read should replay local snapshot");
        assert!(output.contains("\"found\":true"));
        assert!(output.contains("\"payload_bytes\":19"));
        assert!(!output.contains("opaque-local-layout"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn absent_local_root_reads_as_not_found_without_creating_a_journal() {
        let root = temporary_root("absent");
        let request = parse_request(vec![
            "--operation".to_owned(),
            "read".to_owned(),
            "--root".to_owned(),
            root.display().to_string(),
            "--workspace-id".to_owned(),
            "7".to_owned(),
            "--journal-budget-bytes".to_owned(),
            MINIMUM_WORKSPACE_JOURNAL_BUDGET_BYTES.to_string(),
        ])
        .expect("read should parse");
        assert!(execute(request)
            .expect("absent root should be truthful")
            .contains("\"found\":false"));
        assert!(!root.exists());
    }
}
