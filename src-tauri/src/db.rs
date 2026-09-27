use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum SyncStatus {
    Local,
    Cloud,
    Synced,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub sync_status: SyncStatus,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Study {
    pub id: String,
    pub name: String,
    pub description: String,
    pub sync_status: SyncStatus,
    pub updated_at: String,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn init_db() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    
    conn.execute(
        "CREATE TABLE workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sync_status TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        (),
    )?;
    
    conn.execute(
        "CREATE TABLE studies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            sync_status TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        (),
    )?;

    // Insert mock data
    conn.execute(
        "INSERT INTO workspaces (id, name, sync_status, updated_at) VALUES (?1, ?2, ?3, ?4)",
        ("1", "Execution Lab", "Synced", "Modified 1d ago"),
    )?;
    conn.execute(
        "INSERT INTO workspaces (id, name, sync_status, updated_at) VALUES (?1, ?2, ?3, ?4)",
        ("2", "Macro Dashboard", "Local", "Modified 3d ago"),
    )?;
    
    conn.execute(
        "INSERT INTO studies (id, name, description, sync_status, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        ("1", "Volatility Regime Detector", "Indicator", "Synced", "Edited 2d ago"),
    )?;
    conn.execute(
        "INSERT INTO studies (id, name, description, sync_status, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        ("2", "Orderflow Imbalance", "Indicator", "Local", "Edited 5d ago"),
    )?;
    conn.execute(
        "INSERT INTO studies (id, name, description, sync_status, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        ("3", "Mean Reversion", "Strategy", "Cloud", "Edited 2w ago"),
    )?;

    Ok(conn)
}
