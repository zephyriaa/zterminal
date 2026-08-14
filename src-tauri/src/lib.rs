use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStatus {
    execution_permission: &'static str,
    secure_storage: &'static str,
    window_label: &'static str,
}

/**
 * Reports the desktop security posture to the bundled frontend. This command has no
 * broker, filesystem, credential, or order-routing behavior.
 */
#[tauri::command]
fn desktop_status() -> DesktopStatus {
    DesktopStatus {
        execution_permission: "disabled",
        secure_storage: "not_configured",
        window_label: "main",
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![desktop_status])
        .run(tauri::generate_context!())
        .expect("failed to run ZTerminal desktop application");
}
