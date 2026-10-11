//! Test-only JSON command driver for browser regression against real Rust persistence.
use serde_json::{json, Value};
use std::io::Read;
use zt_workstation_local::{Import, ShellPreferences, Store};

fn run() -> Result<Value, String> {
    let root = std::env::args()
        .nth(1)
        .ok_or("Test storage root required")?;
    let mut input = String::new();
    std::io::stdin()
        .take(9 * 1024 * 1024)
        .read_to_string(&mut input)
        .map_err(|e| e.to_string())?;
    let request: Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
    let args = &request["args"];
    let text = |field: &str| {
        args[field]
            .as_str()
            .ok_or_else(|| format!("Missing {field}"))
    };
    let number = |field: &str| {
        args[field]
            .as_u64()
            .ok_or_else(|| format!("Missing {field}"))
    };
    let mut store = Store::open(root)?;
    let value = match request["command"].as_str().ok_or("Missing command")? {
        "get_shell_preferences" => json!(store.preferences()?),
        "save_shell_preferences" => json!(store.save_preferences(
            serde_json::from_value::<ShellPreferences>(args["preferences"].clone())
                .map_err(|e| e.to_string())?
        )?),
        "list_workspaces" => json!(store.list()?),
        "restore_workspace" => json!(store.restore()?),
        "open_workspace" => json!(store.select(text("id")?)?),
        "create_workspace" => json!(store.create(text("id")?.into(), text("name")?.into())?),
        "save_workspace" => json!(store.save(
            text("id")?,
            number("revision")?,
            text("name")?.into(),
            args["from"].as_i64(),
            args["to"].as_i64()
        )?),
        "import_history" => json!(store.import(
            text("id")?,
            number("revision")?,
            serde_json::from_value::<Import>(args["input"].clone()).map_err(|e| e.to_string())?
        )?),
        "load_scene" => json!(store.scene(
            text("id")?,
            number("first")? as usize,
            number("count")? as usize
        )?),
        _ => return Err("Unsupported test command".into()),
    };
    Ok(value)
}
fn main() {
    println!(
        "{}",
        match run() {
            Ok(value) => json!({"ok":true,"value":value}),
            Err(error) => json!({"ok":false,"error":error}),
        }
    );
}
