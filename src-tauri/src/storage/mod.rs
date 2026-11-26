//! SQLite storage management.
//!
//! Open the database under the app data directory, run
//! migrations, and hand out connections to feature modules. Feature
//! modules own their tables; this module owns the pool and schema version.

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub struct Db(pub Mutex<Connection>);

const SCHEMA: &str = "
DROP TABLE IF EXISTS snippets;
CREATE TABLE IF NOT EXISTS clipboard_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    captured_at_ms INTEGER NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calendar_entries (
    id TEXT PRIMARY KEY,
    input TEXT NOT NULL DEFAULT '',
    phase TEXT NOT NULL DEFAULT 'edit',
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
";

pub fn init(app: &AppHandle) -> Result<Connection, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app data dir unavailable: {error}"))?;
    std::fs::create_dir_all(&dir).map_err(|error| format!("data dir create failed: {error}"))?;
    let connection = Connection::open(dir.join("pocket.db"))
        .map_err(|error| format!("database open failed: {error}"))?;
    connection
        .execute_batch(SCHEMA)
        .map_err(|error| format!("schema init failed: {error}"))?;
    Ok(connection)
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
