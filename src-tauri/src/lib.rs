mod commands;
use std::sync::Mutex;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let store = app
                .path()
                .app_local_data_dir()
                .map_err(|e| e.to_string())
                .and_then(zt_workstation_local::Store::open);
            // Storage failures remain visible in the shell instead of causing a startup panic.
            app.manage(commands::LocalState(Mutex::new(store)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_workspaces,
            commands::restore_workspace,
            commands::open_workspace,
            commands::create_workspace,
            commands::save_workspace,
            commands::import_history,
            commands::load_scene,
            commands::get_shell_preferences,
            commands::save_shell_preferences
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ZTerminal local workstation");
}
