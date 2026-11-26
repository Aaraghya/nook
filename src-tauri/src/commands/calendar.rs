use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::calendar;
use crate::storage::{now_ms, Db};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEntryRecord {
    id: String,
    input: String,
    phase: String,
    created_at_ms: i64,
    updated_at_ms: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEntryInput {
    id: String,
    input: String,
    phase: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDraft {
    title: String,
    start_utc: String,
    end_utc: String,
    location: Option<String>,
    details: Option<String>,
}

#[tauri::command]
pub fn calendar_open_event(draft: EventDraft) -> Result<(), String> {
    let url = calendar::build_eventedit_url(
        &draft.title,
        &draft.start_utc,
        &draft.end_utc,
        draft.location.as_deref(),
        draft.details.as_deref(),
    );
    calendar::open_eventedit_url(&url)
}

#[tauri::command]
pub fn calendar_get_entries(db: State<Db>) -> Result<Vec<CalendarEntryRecord>, String> {
    let connection =
        db.0.lock()
            .map_err(|_| "calendar database lock failed".to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, input, phase, created_at_ms, updated_at_ms
             FROM calendar_entries
             ORDER BY created_at_ms ASC",
        )
        .map_err(|error| format!("calendar query prepare failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CalendarEntryRecord {
                id: row.get(0)?,
                input: row.get(1)?,
                phase: row.get(2)?,
                created_at_ms: row.get(3)?,
                updated_at_ms: row.get(4)?,
            })
        })
        .map_err(|error| format!("calendar query failed: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("calendar row decode failed: {error}"))
}

#[tauri::command]
pub fn calendar_save_entry(entry: CalendarEntryInput, db: State<Db>) -> Result<(), String> {
    if entry.phase != "edit" && entry.phase != "preview" {
        return Err("invalid calendar entry phase".to_string());
    }
    let connection =
        db.0.lock()
            .map_err(|_| "calendar database lock failed".to_string())?;
    let timestamp = now_ms() as i64;
    connection
        .execute(
            "INSERT INTO calendar_entries (id, input, phase, created_at_ms, updated_at_ms)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET
                 input = excluded.input,
                 phase = excluded.phase,
                 updated_at_ms = excluded.updated_at_ms",
            params![entry.id, entry.input, entry.phase, timestamp],
        )
        .map_err(|error| format!("calendar save failed: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn calendar_delete_entry(id: String, db: State<Db>) -> Result<(), String> {
    let connection =
        db.0.lock()
            .map_err(|_| "calendar database lock failed".to_string())?;
    connection
        .execute("DELETE FROM calendar_entries WHERE id = ?1", params![id])
        .map_err(|error| format!("calendar delete failed: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn calendar_clear_entries(db: State<Db>) -> Result<(), String> {
    let connection =
        db.0.lock()
            .map_err(|_| "calendar database lock failed".to_string())?;
    connection
        .execute("DELETE FROM calendar_entries", [])
        .map_err(|error| format!("calendar clear failed: {error}"))?;
    Ok(())
}
