//! Packaged, offline native adapter for the existing workstation Store.
use serde_json::{json, Value};
use std::io::Read;
use zt_workstation_local::strategy::{MAX_PARAMETER_BYTES, MAX_SOURCE_BYTES};
use zt_workstation_local::{native::ExactUnits, Import, Store, MAX_IMPORT_BYTES};
fn run(root: &str, request: &str) -> Result<Value, String> {
    let bytes = std::fs::read(request).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_PARAMETER_BYTES + 4096 {
        return Err("Native request exceeds bound".into());
    }
    let r: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let text = |f: &str| r[f].as_str().ok_or_else(|| format!("Missing {f}"));
    let number = |f: &str| text(f)?.parse::<u64>().map_err(|e| e.to_string());
    let mut s = Store::open(root)?;
    match text("command")? {
        "startup" => Ok(json!({"onboardingComplete":s.onboarding_complete()?})),
        "complete_onboarding" => {
            s.complete_onboarding()?;
            Ok(json!({"onboardingComplete":true}))
        }
        "list" => Ok(json!(s.list()?)),
        "presentation" => Ok(json!({"current":s.chart_presentation_at(text("id")?,number("revision")?)?,"defaults":zt_workstation_local::presentation::Presentation::default()})),
        "save_presentation" => Ok(json!(s.save_presentation(text("id")?,number("revision")?,serde_json::from_value(r["presentation"].clone()).map_err(|e|e.to_string())?)?)),
        "drawings" => Ok(json!(s.chart_drawings(text("id")?, number("revision")?)?)),
        "save_drawings" => Ok(json!(s.save_drawings(
            text("id")?,
            number("revision")?,
            serde_json::from_value(r["drawings"].clone()).map_err(|e| e.to_string())?
        )?)),
        "save_indicators" => Ok(json!(s.save_indicators(
            text("id")?,
            number("revision")?,
            serde_json::from_value(r["indicators"].clone()).map_err(|e| e.to_string())?
        )?)),
        "save_replay" => Ok(json!(s.save_replay(
            text("id")?,
            number("revision")?,
            if r["replay"].is_null() {
                None
            } else {
                Some(serde_json::from_value(r["replay"].clone()).map_err(|e| e.to_string())?)
            }
        )?)),
        "catalog" => s.catalog(
            text("kind")?,
            text("search")?,
            r["recent"].as_bool().ok_or("Missing sort")?,
            number("page")?,
        ),
        "catalog_previews" => {
            let records = r["records"].as_array().ok_or("Missing preview records")?;
            if records.len() > 48 {
                return Err("Preview batch exceeds 48 records".into());
            }
            let mut values = Vec::new();
            for record in records {
                let id = record["id"].as_str().ok_or("Missing preview id")?;
                let kind = record["kind"].as_str().ok_or("Missing preview kind")?;
                let revision = record["revision"]
                    .as_u64()
                    .ok_or("Missing preview revision")?;
                let preview = match s.catalog_preview(kind, id, revision) {
                    Ok(value) => value,
                    Err(_) => {
                        json!({"kind":"unavailable","text":"Saved preview unavailable; reopen record to inspect"})
                    }
                };
                values.push(json!({"key":format!("{kind}:{id}:{revision}"),"preview":preview}));
            }
            Ok(json!(values))
        }
        "workspace_action" => s.workspace_action(
            text("action")?,
            text("id")?,
            number("revision")?,
            r["newId"].as_str().unwrap_or(""),
            r["name"].as_str().unwrap_or(""),
        ),
        "study_action" => s.study_action(
            text("action")?,
            text("id")?,
            number("revision")?,
            r["newId"].as_str().unwrap_or(""),
            r["name"].as_str().unwrap_or(""),
        ),
        "trash" => s.trash(),
        "restore_catalog" => s.restore_catalog(text("key")?),
        "restore_workspace" => Ok(json!(s.restore_workspace(text("id")?)?)),
        "study" => s.study(text("id")?),
        "save_study" => {
            let mut bytes = Vec::new();
            std::fs::File::open(text("sourcePath")?)
                .map_err(|e| e.to_string())?
                .take(MAX_SOURCE_BYTES as u64 + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() > MAX_SOURCE_BYTES {
                return Err("Study source exceeds bound".into());
            }
            let source = String::from_utf8(bytes).map_err(|e| e.to_string())?;
            s.save_study(
                text("id")?,
                number("revision")?,
                text("name")?,
                text("kind")?,
                &source,
            )
        }
        "restore" => Ok(json!(s.restore()?)),
        "navigation" => s.navigation(),
        "close_tab" => {
            s.set_tab(text("id")?, false)?;
            Ok(Value::Null)
        }
        "open" => {
            s.set_tab(text("id")?, true)?;
            Ok(json!(s.select(text("id")?)?))
        }
        "create" => {
            if s.open_tabs()?.len()>=16 {return Err("Close a workspace tab before creating another (16 maximum)".into());}
            let w = s.create(text("id")?.into(), text("name")?.into())?;
            s.set_tab(text("id")?, true).map_err(|e|format!("Workspace created locally, but its tab could not open: {e}. Refresh Home to reopen it."))?;
            Ok(json!(w))
        }
        "save_strategy" => {
            let mut bytes = Vec::new();
            std::fs::File::open(text("sourcePath")?)
                .map_err(|e| e.to_string())?
                .take(MAX_SOURCE_BYTES as u64 + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() > MAX_SOURCE_BYTES {
                return Err("Strategy source exceeds 256,000 bytes".into());
            }
            let source = String::from_utf8(bytes).map_err(|e| e.to_string())?;
            Ok(json!(s.save_strategy(
                text("id")?,
                number("revision")?,
                source,
                r["parameters"].clone()
            )?))
        }
        "save" => Ok(json!(s.save(
            text("id")?,
            number("revision")?,
            text("name")?.into(),
            r["from"]
                .as_str()
                .map(|s| s.parse())
                .transpose()
                .map_err(|e: std::num::ParseIntError| e.to_string())?,
            r["to"]
                .as_str()
                .map(|s| s.parse())
                .transpose()
                .map_err(|e: std::num::ParseIntError| e.to_string())?
        )?)),
        "scene" => s.native_scene(
            text("id")?,
            number("revision")?,
            r["cutoffNs"]
                .as_str()
                .map(|s| s.parse())
                .transpose()
                .map_err(|e: std::num::ParseIntError| e.to_string())?,
        ),
        "import" => {
            let path = std::path::Path::new(text("path")?);
            if std::fs::metadata(path).map_err(|e| e.to_string())?.len() > MAX_IMPORT_BYTES as u64 {
                return Err("Import exceeds 8 MiB".into());
            }
            let csv = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
            let exact = ExactUnits {
                price_step: text("priceStep")?.into(),
                quantity_step: text("quantityStep")?.into(),
            };
            let input = Import {
                csv,
                source_name: path
                    .file_name()
                    .ok_or("Source name missing")?
                    .to_string_lossy()
                    .into(),
                symbol: text("symbol")?.into(),
                interval_ms: number("intervalMs")?,
                tick_size: exact
                    .price_step
                    .parse()
                    .map_err(|e: std::num::ParseFloatError| e.to_string())?,
                quantity_step: exact
                    .quantity_step
                    .parse()
                    .map_err(|e: std::num::ParseFloatError| e.to_string())?,
            };
            Ok(json!(s.import_native(
                text("id")?,
                number("revision")?,
                input,
                exact
            )?))
        }
        _ => Err("Unsupported native command".into()),
    }
}
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 4 {
        eprintln!("Usage: zt-native-store STORAGE REQUEST RESPONSE");
        std::process::exit(2);
    }
    let result = match run(&args[1], &args[2]) {
        Ok(v) => json!({"ok":true,"value":v}),
        Err(e) => json!({"ok":false,"error":e}),
    };
    if let Err(e) = std::fs::write(&args[3], serde_json::to_vec(&result).unwrap()) {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
