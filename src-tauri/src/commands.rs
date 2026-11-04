use std::sync::Mutex;
use tauri::{State, WebviewWindow};
use zt_workstation_local::{ChartBar, Import, Store, Summary, Workspace};

pub struct LocalState(pub Mutex<Result<Store, String>>);

fn with_store<T>(
    window: WebviewWindow,
    state: State<'_, LocalState>,
    action: impl FnOnce(&mut Store) -> Result<T, String>,
) -> Result<T, String> {
    let url = window.url().map_err(|e| e.to_string())?;
    if !local_window(window.label(), &url, cfg!(debug_assertions)) {
        return Err("Local workstation commands require the bundled main window".into());
    }
    // ponytail: one connection for a single-user window; move work off-thread if measured latency warrants it.
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let store = state.as_mut().map_err(|e| e.clone())?;
    action(store)
}

fn local_window(label: &str, url: &tauri::Url, development: bool) -> bool {
    label == "main"
        && (url.scheme() == "tauri" && url.host_str() == Some("localhost") && url.port().is_none()
            || url.scheme() == "http"
                && url.host_str() == Some("tauri.localhost")
                && url.port().is_none()
            || development
                && url.scheme() == "http"
                && url.host_str() == Some("127.0.0.1")
                && url.port() == Some(1420))
}

#[tauri::command]
pub fn list_workspaces(
    window: WebviewWindow,
    state: State<'_, LocalState>,
) -> Result<Vec<Summary>, String> {
    with_store(window, state, |s| s.list())
}
#[tauri::command]
pub fn restore_workspace(
    window: WebviewWindow,
    state: State<'_, LocalState>,
) -> Result<Option<Workspace>, String> {
    with_store(window, state, |s| s.restore())
}
#[tauri::command]
pub fn open_workspace(
    window: WebviewWindow,
    state: State<'_, LocalState>,
    id: String,
) -> Result<Workspace, String> {
    with_store(window, state, |s| s.select(&id))
}
#[tauri::command]
pub fn create_workspace(
    window: WebviewWindow,
    state: State<'_, LocalState>,
    id: String,
    name: String,
) -> Result<Workspace, String> {
    with_store(window, state, |s| s.create(id, name))
}
#[tauri::command]
pub fn save_workspace(
    window: WebviewWindow,
    state: State<'_, LocalState>,
    id: String,
    revision: u64,
    name: String,
    from: Option<i64>,
    to: Option<i64>,
) -> Result<Workspace, String> {
    with_store(window, state, |s| s.save(&id, revision, name, from, to))
}
#[tauri::command]
pub fn import_history(
    window: WebviewWindow,
    state: State<'_, LocalState>,
    id: String,
    revision: u64,
    input: Import,
) -> Result<Workspace, String> {
    with_store(window, state, |s| s.import(&id, revision, input))
}
#[tauri::command]
pub fn load_scene(
    window: WebviewWindow,
    state: State<'_, LocalState>,
    id: String,
    first: usize,
    count: usize,
) -> Result<Vec<ChartBar>, String> {
    with_store(window, state, |s| s.scene(&id, first, count))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_the_local_main_window_can_use_storage() {
        for (url, development, allowed) in [
            ("http://tauri.localhost/", false, true),
            ("tauri://localhost/", false, true),
            ("https://zterminal.dpdns.org/terminal", true, false),
            ("http://tauri.localhost:8000/", false, false),
            ("http://127.0.0.1:1420/", false, false),
            ("http://127.0.0.1:1420/", true, true),
            ("http://localhost:1420/", true, false),
            ("file:///C:/workspace.html", true, false),
        ] {
            let url = tauri::Url::parse(url).unwrap();
            assert_eq!(local_window("main", &url, development), allowed);
            assert!(!local_window("other", &url, development));
        }
    }
}
