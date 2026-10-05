//! Internal offline paper command. No secrets, cloud, strategy execution or HTTP.
use serde::Deserialize;
use std::io::{self, BufRead, Read, Write};
use zt_execution::{
    ExecutionError, ExecutionMode, Journal, LimitOrder, PaperConfig, PaperEngine, Quote,
};

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum Command {
    Quote { quote: Quote, now_ms: i64 },
    Resume { now_ms: i64 },
    PlaceLimit { order: LimitOrder, now_ms: i64 },
    Cancel { client_id: String },
    Pause {},
    KillSwitch {},
    Status {},
    Quit {},
}

fn run() -> Result<(), ExecutionError> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() != 2 {
        return Err(ExecutionError::InvalidInput);
    }
    let journal = Journal::open(&args[0])?;
    let mut config_bytes = Vec::new();
    std::fs::File::open(&args[1])
        .map_err(|_| ExecutionError::InvalidInput)?
        .take(16_385)
        .read_to_end(&mut config_bytes)
        .map_err(|_| ExecutionError::InvalidInput)?;
    if config_bytes.len() > 16_384 {
        return Err(ExecutionError::InvalidInput);
    }
    let config: PaperConfig =
        serde_json::from_slice(&config_bytes).map_err(|_| ExecutionError::InvalidInput)?;
    let mut engine = PaperEngine::open(journal, config, ExecutionMode::Paper)?;
    let stdin = io::stdin();
    let mut input = stdin.lock();
    let mut output = io::stdout().lock();
    loop {
        // Read at most 16KB, including malformed inputs; no unbounded line allocation.
        let mut bytes = Vec::new();
        let mut eof = false;
        loop {
            let chunk = input.fill_buf().map_err(|_| ExecutionError::InvalidInput)?;
            if chunk.is_empty() {
                eof = true;
                break;
            }
            let length = chunk
                .iter()
                .position(|b| *b == b'\n')
                .map_or(chunk.len(), |i| i + 1);
            if bytes.len() + length > 16_384 {
                engine.pause()?;
                return Err(ExecutionError::InvalidInput);
            }
            let newline = chunk[length - 1] == b'\n';
            bytes.extend_from_slice(&chunk[..length]);
            input.consume(length);
            if newline {
                break;
            }
        }
        if eof && bytes.is_empty() {
            engine.pause()?;
            break;
        }
        let command = serde_json::from_slice::<Command>(&bytes);
        let result = match command {
            Ok(Command::Quote { quote, now_ms }) => engine
                .on_quote(quote, now_ms)
                .map(|fills| serde_json::json!({"fills":fills})),
            Ok(Command::Resume { now_ms }) => engine
                .resume(now_ms)
                .map(|()| serde_json::json!({"resumed":true})),
            Ok(Command::PlaceLimit { order, now_ms }) => engine
                .place_limit(order, now_ms)
                .map(|id| serde_json::json!({"client_id":id})),
            Ok(Command::Cancel { client_id }) => engine
                .cancel_owned(&client_id)
                .map(|()| serde_json::json!({"cancelled":true})),
            Ok(Command::Pause {}) => engine.pause().map(|()| serde_json::json!({"paused":true})),
            Ok(Command::KillSwitch {}) => engine
                .engage_kill_switch()
                .map(|()| serde_json::json!({"kill_switch":true})),
            Ok(Command::Status {}) => engine
                .snapshot()
                .and_then(|v| serde_json::to_value(v).map_err(|_| ExecutionError::InvalidInput)),
            Ok(Command::Quit {}) => {
                engine.pause()?;
                break;
            }
            Err(_) => Err(ExecutionError::InvalidInput),
        };
        // Storage/schema/arithmetic faults stop this owner, rather than allowing
        // a subsequent command to resume against potentially inconsistent state.
        let fatal = matches!(
            &result,
            Err(ExecutionError::Storage | ExecutionError::Schema | ExecutionError::Arithmetic)
        );
        // Only structured allowed fields or static errors, never echo input/stdin.
        let response = match result {
            Ok(value) => serde_json::json!({"ok":true,"result":value}),
            Err(error) => serde_json::json!({"ok":false,"error":error.to_string()}),
        };
        writeln!(output, "{response}").map_err(|_| ExecutionError::Storage)?;
        output.flush().map_err(|_| ExecutionError::Storage)?;
        if fatal {
            engine.pause()?;
            return Err(ExecutionError::Storage);
        }
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
