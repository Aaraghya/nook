use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{Connection, Row};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardSequenceNumber,
    IsClipboardFormatAvailable, OpenClipboard, SetClipboardData,
};
use windows::Win32::System::Memory::{
    GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE,
};

use crate::storage::Db;

const CLIPBOARD_EVENT: &str = "clipboard:new";
const CF_UNICODETEXT: u32 = 13;
const HISTORY_CAP: usize = 100;
const MAX_ENTRY_CHARS: usize = 100_000;
const POLL_INTERVAL_MS: u64 = 500;
const OPEN_ATTEMPTS: u32 = 3;
const OPEN_RETRY_DELAY_MS: u64 = 50;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardEntry {
    pub id: String,
    pub content: String,
    pub captured_at_ms: u64,
    pub pinned: bool,
}

pub struct ClipboardState {
    pub(crate) history: Mutex<Vec<ClipboardEntry>>,
    pub(crate) last_sequence: Mutex<u32>,
    pub(crate) suppressed_content: Mutex<Option<String>>,
}

fn row_to_entry(row: &Row) -> rusqlite::Result<ClipboardEntry> {
    Ok(ClipboardEntry {
        id: row.get::<_, i64>(0)?.to_string(),
        content: row.get(1)?,
        captured_at_ms: row.get::<_, i64>(2)?.max(0) as u64,
        pinned: row.get::<_, i64>(3)? != 0,
    })
}

pub(crate) fn sort_history(entries: &mut [ClipboardEntry]) {
    entries.sort_by(|a, b| {
        b.pinned
            .cmp(&a.pinned)
            .then_with(|| b.captured_at_ms.cmp(&a.captured_at_ms))
            .then_with(|| {
                let a_id = a.id.parse::<i64>().unwrap_or(0);
                let b_id = b.id.parse::<i64>().unwrap_or(0);
                b_id.cmp(&a_id)
            })
    });
}

pub fn load_entries(connection: &Connection) -> Result<Vec<ClipboardEntry>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, content, captured_at_ms, pinned
             FROM clipboard_entries
             ORDER BY pinned DESC, captured_at_ms DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], row_to_entry)
        .map_err(|error| error.to_string())?;
    let mut entries = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    sort_history(&mut entries);
    Ok(entries)
}

pub fn insert_entry(
    connection: &Connection,
    content: &str,
    captured_at_ms: u64,
) -> Result<ClipboardEntry, String> {
    connection
        .execute(
            "DELETE FROM clipboard_entries WHERE pinned = 0 AND content = ?1",
            rusqlite::params![content],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO clipboard_entries (content, captured_at_ms, pinned)
             VALUES (?1, ?2, 0)",
            rusqlite::params![content, captured_at_ms as i64],
        )
        .map_err(|error| error.to_string())?;
    let id = connection.last_insert_rowid().to_string();
    Ok(ClipboardEntry {
        id,
        content: content.to_string(),
        captured_at_ms,
        pinned: false,
    })
}

pub fn set_entry_pinned(connection: &Connection, id: &str, pinned: bool) -> Result<(), String> {
    let numeric_id = id
        .parse::<i64>()
        .map_err(|_| "invalid clip id".to_string())?;
    connection
        .execute(
            "UPDATE clipboard_entries SET pinned = ?1 WHERE id = ?2",
            rusqlite::params![if pinned { 1 } else { 0 }, numeric_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn delete_stored_entry(connection: &Connection, id: &str) -> Result<(), String> {
    let numeric_id = id
        .parse::<i64>()
        .map_err(|_| "invalid clip id".to_string())?;
    connection
        .execute(
            "DELETE FROM clipboard_entries WHERE id = ?1",
            rusqlite::params![numeric_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn clear_stored_entries(connection: &Connection) -> Result<(), String> {
    connection
        .execute("DELETE FROM clipboard_entries", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn init(app: &AppHandle) {
    let initial_history = {
        let db = app.state::<Db>();
        let connection = db.0.lock().unwrap();
        load_entries(&connection).unwrap_or_default()
    };
    app.manage(ClipboardState {
        history: Mutex::new(initial_history),
        last_sequence: Mutex::new(0),
        suppressed_content: Mutex::new(None),
    });
    let handle = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
        let sequence = unsafe { GetClipboardSequenceNumber() };
        let state = handle.state::<ClipboardState>();
        let mut stored = state.last_sequence.lock().unwrap();
        if sequence == 0 || sequence == *stored {
            continue;
        }
        *stored = sequence;
        drop(stored);
        drop(state);
        capture_clipboard_text(&handle);
    });
}

fn capture_clipboard_text(app: &AppHandle) {
    let Some(text) = read_clipboard_text() else {
        return;
    };
    if text.trim().is_empty() || text.chars().count() > MAX_ENTRY_CHARS {
        return;
    }
    let state = app.state::<ClipboardState>();
    {
        let mut suppressed = state.suppressed_content.lock().unwrap();
        if suppressed.as_deref() == Some(text.as_str()) {
            *suppressed = None;
            return;
        }
        *suppressed = None;
    }
    let mut history = state.history.lock().unwrap();
    if history
        .iter()
        .find(|entry| !entry.pinned)
        .is_some_and(|entry| entry.content == text)
    {
        return;
    }
    if history
        .iter()
        .any(|entry| entry.pinned && entry.content == text)
    {
        return;
    }
    let captured_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0);
    let db = app.state::<Db>();
    let connection = db.0.lock().unwrap();
    let Ok(entry) = insert_entry(&connection, &text, captured_at_ms) else {
        return;
    };
    history.retain(|existing| existing.pinned || existing.content != text);
    history.push(entry.clone());
    sort_history(&mut history);
    while history.len() > HISTORY_CAP {
        match history.iter().rposition(|item| !item.pinned) {
            Some(index) => {
                let evicted = history.remove(index);
                let _ = delete_stored_entry(&connection, &evicted.id);
            }
            None => break,
        }
    }
    drop(connection);
    drop(history);
    let _ = app.emit(CLIPBOARD_EVENT, &entry);
}

pub(crate) fn write_clipboard_text(text: &str) -> Result<(), String> {
    unsafe { OpenClipboard(None) }.map_err(|error| error.to_string())?;
    let result = write_open_clipboard(text);
    let close_result = unsafe { CloseClipboard() };
    result.and(close_result.map_err(|error| error.to_string()))
}

fn write_open_clipboard(text: &str) -> Result<(), String> {
    unsafe { EmptyClipboard() }.map_err(|error| error.to_string())?;
    let mut units: Vec<u16> = text.encode_utf16().collect();
    units.push(0);
    let byte_len = units.len() * 2;
    let handle = unsafe { GlobalAlloc(GMEM_MOVEABLE, byte_len) }
        .map_err(|error| error.to_string())?;
    let pointer = unsafe { GlobalLock(handle) };
    if pointer.is_null() {
        let _ = unsafe { GlobalFree(Some(handle)) };
        return Err("clipboard memory lock failed".to_string());
    }
    unsafe {
        core::ptr::copy_nonoverlapping(
            units.as_ptr().cast::<u8>(),
            pointer.cast::<u8>(),
            byte_len,
        );
    }
    let _ = unsafe { GlobalUnlock(handle) };
    match unsafe { SetClipboardData(CF_UNICODETEXT, Some(HANDLE(handle.0))) } {
        Ok(_) => Ok(()),
        Err(error) => {
            let _ = unsafe { GlobalFree(Some(handle)) };
            Err(error.to_string())
        }
    }
}

fn read_clipboard_text() -> Option<String> {
    for _ in 0..OPEN_ATTEMPTS {
        if unsafe { OpenClipboard(None) }.is_ok() {
            let text = read_open_clipboard();
            let _ = unsafe { CloseClipboard() };
            return text;
        }
        thread::sleep(Duration::from_millis(OPEN_RETRY_DELAY_MS));
    }
    None
}

fn read_open_clipboard() -> Option<String> {
    if unsafe { IsClipboardFormatAvailable(CF_UNICODETEXT) }.is_err() {
        return None;
    }
    let handle = unsafe { GetClipboardData(CF_UNICODETEXT) }.ok()?;
    let global = HGLOBAL(handle.0);
    let pointer = unsafe { GlobalLock(global) };
    if pointer.is_null() {
        return None;
    }
    let byte_count = unsafe { GlobalSize(global) };
    let units = unsafe {
        core::slice::from_raw_parts(pointer as *const u16, byte_count / 2)
    };
    let length = units
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(units.len());
    let text = String::from_utf16_lossy(&units[..length]);
    let _ = unsafe { GlobalUnlock(global) };
    Some(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE clipboard_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                captured_at_ms INTEGER NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn pinned_entries_sort_above_unpinned_and_persist_in_sqlite() {
        let conn = setup_db();
        let e1 = insert_entry(&conn, "oldest", 1000).unwrap();
        let e2 = insert_entry(&conn, "middle", 2000).unwrap();
        let _e3 = insert_entry(&conn, "newest", 3000).unwrap();

        set_entry_pinned(&conn, &e1.id, true).unwrap();
        set_entry_pinned(&conn, &e2.id, true).unwrap();

        let loaded = load_entries(&conn).unwrap();
        let contents: Vec<&str> = loaded.iter().map(|e| e.content.as_str()).collect();
        assert_eq!(contents, vec!["middle", "oldest", "newest"]);

        let _e4 = insert_entry(&conn, "newer", 4000).unwrap();
        let reloaded = load_entries(&conn).unwrap();
        let reloaded_contents: Vec<&str> = reloaded.iter().map(|e| e.content.as_str()).collect();
        assert_eq!(reloaded_contents, vec!["middle", "oldest", "newer", "newest"]);

        set_entry_pinned(&conn, &e2.id, false).unwrap();
        let after_unpin = load_entries(&conn).unwrap();
        let after_unpin_contents: Vec<&str> =
            after_unpin.iter().map(|e| e.content.as_str()).collect();
        assert_eq!(
            after_unpin_contents,
            vec!["oldest", "newer", "newest", "middle"]
        );
    }
}
