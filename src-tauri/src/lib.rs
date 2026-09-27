mod db;
mod commands;

use serde::Serialize;
use std::sync::Mutex;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStatus {
    execution_permission: &'static str,
    secure_storage: &'static str,
    window_label: &'static str,
}

#[tauri::command]
fn desktop_status() -> DesktopStatus {
    DesktopStatus {
        execution_permission: "disabled",
        secure_storage: "not_configured",
        window_label: "main",
    }
}

pub fn run() {
    let conn = db::init_db().expect("Failed to initialize local database");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(db::DbState {
            conn: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            desktop_status,
            commands::fetch_dashboard_data,
            commands::resize_window,
            commands::trigger_sync
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ZTerminal desktop application");
}
