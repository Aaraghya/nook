//! Pinned snippets.
//!
//! Milestone 5: categorised, searchable snippet storage. Shares the SQLite
//! infrastructure with `clipboard` but keeps a logically
//! separate data model.

use rusqlite::{Connection, Row};
use serde::Serialize;

use crate::storage::now_ms;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub label: String,
    pub content: String,
    pub category: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

const SNIPPET_COLUMNS: &str = "id, label, content, category, created_at_ms, updated_at_ms";

fn row_to_snippet(row: &Row) -> rusqlite::Result<Snippet> {
    Ok(Snippet {
        id: row.get::<_, i64>(0)?.to_string(),
        label: row.get(1)?,
        content: row.get(2)?,
        category: row.get(3)?,
        created_at_ms: row.get::<_, i64>(4)?.max(0) as u64,
        updated_at_ms: row.get::<_, i64>(5)?.max(0) as u64,
    })
}

pub fn list(connection: &Connection) -> Result<Vec<Snippet>, String> {
    let mut statement = connection
        .prepare(&format!(
            "SELECT {SNIPPET_COLUMNS} FROM snippets ORDER BY updated_at_ms DESC"
        ))
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], row_to_snippet)
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn create(
    connection: &Connection,
    label: &str,
    content: &str,
    category: &str,
) -> Result<Snippet, String> {
    let now = now_ms() as i64;
    connection
        .execute(
            "INSERT INTO snippets (label, content, category, created_at_ms, updated_at_ms)
             VALUES (?1, ?2, ?3, ?4, ?4)",
            rusqlite::params![label, content, category, now],
        )
        .map_err(|error| error.to_string())?;
    Ok(Snippet {
        id: connection.last_insert_rowid().to_string(),
        label: label.to_string(),
        content: content.to_string(),
        category: category.to_string(),
        created_at_ms: now as u64,
        updated_at_ms: now as u64,
    })
}

pub fn update(
    connection: &Connection,
    id: &str,
    label: &str,
    content: &str,
    category: &str,
) -> Result<Snippet, String> {
    let numeric_id = parse_id(id)?;
    let now = now_ms() as i64;
    let changed = connection
        .execute(
            "UPDATE snippets SET label = ?1, content = ?2, category = ?3, updated_at_ms = ?4
             WHERE id = ?5",
            rusqlite::params![label, content, category, now, numeric_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("snippet not found".to_string());
    }
    fetch(connection, numeric_id)
}

pub fn clear_all(connection: &Connection) -> Result<(), String> {
    connection
        .execute("DELETE FROM snippets", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn delete(connection: &Connection, id: &str) -> Result<(), String> {
    let numeric_id = parse_id(id)?;
    let changed = connection
        .execute(
            "DELETE FROM snippets WHERE id = ?1",
            rusqlite::params![numeric_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("snippet not found".to_string());
    }
    Ok(())
}

pub fn content_of(connection: &Connection, id: &str) -> Result<String, String> {
    let numeric_id = parse_id(id)?;
    connection
        .query_row(
            "SELECT content FROM snippets WHERE id = ?1",
            rusqlite::params![numeric_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|error| error.to_string())
}

fn fetch(connection: &Connection, id: i64) -> Result<Snippet, String> {
    connection
        .query_row(
            &format!("SELECT {SNIPPET_COLUMNS} FROM snippets WHERE id = ?1"),
            rusqlite::params![id],
            row_to_snippet,
        )
        .map_err(|error| error.to_string())
}

fn parse_id(id: &str) -> Result<i64, String> {
    id.parse::<i64>()
        .map_err(|_| "invalid snippet id".to_string())
}
