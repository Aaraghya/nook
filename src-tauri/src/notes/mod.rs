//! Quick notes — "Pinboard".
//!
//! Milestone 5: CRUD + search + pinning for lightweight notes, persisted
//! via the `storage` module. Auto-save is frontend-driven with debounced
//! writes routed through commands here.

use rusqlite::{Connection, Row};
use serde::Serialize;

use crate::storage::now_ms;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

const NOTE_COLUMNS: &str = "id, title, body, pinned, created_at_ms, updated_at_ms";

fn row_to_note(row: &Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get::<_, i64>(0)?.to_string(),
        title: row.get(1)?,
        body: row.get(2)?,
        pinned: row.get::<_, i64>(3)? != 0,
        created_at_ms: row.get::<_, i64>(4)?.max(0) as u64,
        updated_at_ms: row.get::<_, i64>(5)?.max(0) as u64,
    })
}

pub fn list(connection: &Connection) -> Result<Vec<Note>, String> {
    let mut statement = connection
        .prepare(&format!(
            "SELECT {NOTE_COLUMNS} FROM notes ORDER BY pinned DESC, updated_at_ms DESC"
        ))
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], row_to_note)
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn create(connection: &Connection) -> Result<Note, String> {
    let now = now_ms() as i64;
    connection
        .execute(
            "INSERT INTO notes (created_at_ms, updated_at_ms) VALUES (?1, ?1)",
            rusqlite::params![now],
        )
        .map_err(|error| error.to_string())?;
    Ok(Note {
        id: connection.last_insert_rowid().to_string(),
        title: String::new(),
        body: String::new(),
        pinned: false,
        created_at_ms: now as u64,
        updated_at_ms: now as u64,
    })
}

pub fn update(
    connection: &Connection,
    id: &str,
    title: &str,
    body: &str,
) -> Result<Note, String> {
    let numeric_id = parse_id(id)?;
    let now = now_ms() as i64;
    let changed = connection
        .execute(
            "UPDATE notes SET title = ?1, body = ?2, updated_at_ms = ?3 WHERE id = ?4",
            rusqlite::params![title, body, now, numeric_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("note not found".to_string());
    }
    fetch(connection, numeric_id)
}

pub fn toggle_pin(connection: &Connection, id: &str) -> Result<Note, String> {
    let numeric_id = parse_id(id)?;
    let changed = connection
        .execute(
            "UPDATE notes SET pinned = 1 - pinned WHERE id = ?1",
            rusqlite::params![numeric_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("note not found".to_string());
    }
    fetch(connection, numeric_id)
}

pub fn delete(connection: &Connection, id: &str) -> Result<(), String> {
    let numeric_id = parse_id(id)?;
    let changed = connection
        .execute(
            "DELETE FROM notes WHERE id = ?1",
            rusqlite::params![numeric_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("note not found".to_string());
    }
    Ok(())
}

fn fetch(connection: &Connection, id: i64) -> Result<Note, String> {
    connection
        .query_row(
            &format!("SELECT {NOTE_COLUMNS} FROM notes WHERE id = ?1"),
            rusqlite::params![id],
            row_to_note,
        )
        .map_err(|error| error.to_string())
}

fn parse_id(id: &str) -> Result<i64, String> {
    id.parse::<i64>().map_err(|_| "invalid note id".to_string())
}
