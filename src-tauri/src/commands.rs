use serde::Serialize;
use tauri::{State, Window};
use crate::db::{DbState, SyncStatus, Workspace, Study};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub workspaces: Vec<Workspace>,
    pub studies: Vec<Study>,
}

#[tauri::command]
pub fn fetch_dashboard_data(state: State<'_, DbState>) -> Result<DashboardData, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT id, name, sync_status, updated_at FROM workspaces").map_err(|e| e.to_string())?;
    let workspace_iter = stmt.query_map([], |row| {
        let status_str: String = row.get(2)?;
        let sync_status = match status_str.as_str() {
            "Synced" => SyncStatus::Synced,
            "Cloud" => SyncStatus::Cloud,
            _ => SyncStatus::Local,
        };
        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            sync_status,
            updated_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut workspaces = Vec::new();
    for w in workspace_iter {
        workspaces.push(w.map_err(|e| e.to_string())?);
    }

    let mut stmt = conn.prepare("SELECT id, name, description, sync_status, updated_at FROM studies").map_err(|e| e.to_string())?;
    let studies_iter = stmt.query_map([], |row| {
        let status_str: String = row.get(3)?;
        let sync_status = match status_str.as_str() {
            "Synced" => SyncStatus::Synced,
            "Cloud" => SyncStatus::Cloud,
            _ => SyncStatus::Local,
        };
        Ok(Study {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            sync_status,
            updated_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut studies = Vec::new();
    for s in studies_iter {
        studies.push(s.map_err(|e| e.to_string())?);
    }

    Ok(DashboardData { workspaces, studies })
}

#[tauri::command]
pub fn resize_window(window: Window, width: f64, height: f64) {
    let new_size = tauri::PhysicalSize::new(width as u32, height as u32);
    let _ = window.set_size(new_size);
    let _ = window.center();
}

#[tauri::command]
pub fn trigger_sync(id: String, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE workspaces SET sync_status = 'Synced' WHERE id = ?1",
        (&id,),
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE studies SET sync_status = 'Synced' WHERE id = ?1",
        (&id,),
    ).map_err(|e| e.to_string())?;

    Ok(())
}
