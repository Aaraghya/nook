//! SQLite storage management.
//!
//! Milestone 5: open the database under the app data directory, run
//! migrations, and hand out connections to feature modules. Feature
//! modules own their tables; this module owns the pool and schema version.

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub struct Db(pub Mutex<Connection>);

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
";

pub fn init(app: &AppHandle) -> Result<Connection, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app data dir unavailable: {error}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("data dir create failed: {error}"))?;
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
