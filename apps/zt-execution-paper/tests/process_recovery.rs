//! Real process termination and command-boundary recovery, not just Drop/reopen.
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use tempfile::TempDir;

const CONFIG: &str = r#"{
 "account_id":"paper_account","deployment_id":"strategy_1",
 "instrument":{"symbol":"BTCUSDT","price_tick":"0.01","quantity_step":"0.001",
 "min_quantity":"0.001","max_quantity":"100","min_notional":"1"},
 "initial_cash":"10000","fee_bps":"10","slippage_bps":"0","latency_ms":100,"order_ttl_ms":5000,
 "limits":{"max_order_notional":"5000","max_position_notional":"10000","max_spread_bps":"100",
 "max_orders_per_minute":10,"max_quote_age_ms":1000}}
"#;

struct Process {
    child: Child,
    input: std::process::ChildStdin,
    output: BufReader<std::process::ChildStdout>,
}
impl Process {
    fn start(dir: &TempDir) -> Self {
        std::fs::write(dir.path().join("config.json"), CONFIG).unwrap();
        let mut child = Command::new(env!("CARGO_BIN_EXE_zt-execution-paper"))
            .arg(dir.path().join("execution.sqlite3"))
            .arg(dir.path().join("config.json"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let input = child.stdin.take().unwrap();
        let output = BufReader::new(child.stdout.take().unwrap());
        Self {
            child,
            input,
            output,
        }
    }
    fn send(&mut self, command: &str) -> serde_json::Value {
        writeln!(self.input, "{command}").unwrap();
        self.input.flush().unwrap();
        let mut line = String::new();
        self.output.read_line(&mut line).unwrap();
        serde_json::from_str(&line).unwrap()
    }
    fn quote(&mut self, seq: u64, now: i64) -> serde_json::Value {
        self.send(&format!(r#"{{"op":"quote","now_ms":{now},"quote":{{"symbol":"BTCUSDT","sequence":{seq},"received_ms":{now},"bid":"99.99","ask":"100","bid_quantity":"100","ask_quantity":"100"}}}}"#))
    }
}
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[test]
fn kill_after_committed_intent_or_fill_preserves_account_without_replay() {
    let dir = TempDir::new().unwrap();
    {
        let mut process = Process::start(&dir);
        assert_eq!(process.quote(1, 0)["ok"], true);
        assert_eq!(process.send(r#"{"op":"resume","now_ms":0}"#)["ok"], true);
        assert_eq!(process.send(r#"{"op":"place_limit","now_ms":0,"order":{"symbol":"BTCUSDT","side":"Buy","quantity":"1","price":"100"}}"#)["ok"],true);
        // Child is force-terminated by Drop, with a committed unfilled intent.
    }
    {
        let mut process = Process::start(&dir);
        let status = process.send(r#"{"op":"status"}"#);
        assert_eq!(status["result"]["active_orders"], 0);
        assert_eq!(status["result"]["cash"], "10000");
        assert_eq!(status["result"]["paused"], true);
        process.quote(2, 100);
        process.send(r#"{"op":"resume","now_ms":100}"#);
        process.send(r#"{"op":"place_limit","now_ms":100,"order":{"symbol":"BTCUSDT","side":"Buy","quantity":"1","price":"100"}}"#);
        assert_eq!(process.quote(3, 200)["result"]["fills"], 1);
        // Force terminate after fill/balance/cursor committed together.
    }
    let mut process = Process::start(&dir);
    let before = process.send(r#"{"op":"status"}"#);
    let restored: zt_execution::PaperSnapshot =
        serde_json::from_value(before["result"].clone()).unwrap();
    assert_eq!(restored.cash.normalize().to_string(), "9899.9");
    assert_eq!(restored.quantity.normalize().to_string(), "1");
    assert_eq!(before["result"]["fill_count"], 1);
    assert_eq!(process.quote(3, 200)["result"]["fills"], 0);
    assert_eq!(
        process.send(r#"{"op":"status"}"#)["result"]["fill_count"],
        1
    );
}

#[test]
fn command_errors_never_echo_secret_sentinels_and_quit_exits() {
    let dir = TempDir::new().unwrap();
    let mut process = Process::start(&dir);
    for command in [
        r#"{"op":"sign","secret_key":"SECRET_SENTINEL_97","api_key":"KEY_SENTINEL_42"}"#,
        r#"{"op":"status","signature":"SIGNATURE_SENTINEL_82"}"#,
        "MALFORMED_SECRET_SENTINEL_45",
    ] {
        let response = process.send(command).to_string();
        assert!(!response.contains("SENTINEL"));
        assert!(response.contains("invalid execution input"));
    }
    writeln!(process.input, "{{\"op\":\"quit\"}}").unwrap();
    process.input.flush().unwrap();
    assert!(process.child.wait().unwrap().success());
}

#[test]
fn oversized_commands_terminate_without_echo() {
    let dir = TempDir::new().unwrap();
    let mut process = Process::start(&dir);
    let oversized = "SENSITIVE_SENTINEL".repeat(1000);
    let _ = writeln!(process.input, "{oversized}");
    let _ = process.input.flush();
    assert!(!process.child.wait().unwrap().success());
}
