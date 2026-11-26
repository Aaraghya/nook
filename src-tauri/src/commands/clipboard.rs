use tauri::State;

use crate::clipboard::{
    clear_stored_entries, delete_stored_entry, set_entry_pinned, sort_history,
    write_clipboard_text, ClipboardEntry, ClipboardState,
};
use crate::storage::Db;

#[tauri::command]
pub fn clipboard_get_entries(state: State<ClipboardState>) -> Vec<ClipboardEntry> {
    let mut history = state.history.lock().unwrap();
    sort_history(&mut history);
    history.clone()
}

#[tauri::command]
pub fn clipboard_copy(state: State<ClipboardState>, id: String) -> Result<(), String> {
    let entry = state
        .history
        .lock()
        .unwrap()
        .iter()
        .find(|entry| entry.id == id)
        .cloned();
    let Some(entry) = entry else {
        return Err("clip not found".to_string());
    };
    *state.suppressed_content.lock().unwrap() = Some(entry.content.clone());
    if let Err(error) = write_clipboard_text(&entry.content) {
        *state.suppressed_content.lock().unwrap() = None;
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
pub fn clipboard_toggle_pin(
    state: State<ClipboardState>,
    db: State<Db>,
    id: String,
) -> Result<(), String> {
    let mut history = state.history.lock().unwrap();
    let Some(entry) = history.iter_mut().find(|entry| entry.id == id) else {
        return Err("clip not found".to_string());
    };
    let next_pinned = !entry.pinned;
    let connection = db.0.lock().unwrap();
    set_entry_pinned(&connection, &id, next_pinned)?;
    entry.pinned = next_pinned;
    sort_history(&mut history);
    Ok(())
}

#[tauri::command]
pub fn clipboard_delete(
    state: State<ClipboardState>,
    db: State<Db>,
    id: String,
) -> Result<(), String> {
    let mut history = state.history.lock().unwrap();
    let original_len = history.len();
    history.retain(|entry| entry.id != id);
    if history.len() == original_len {
        Err("clip not found".to_string())
    } else {
        let connection = db.0.lock().unwrap();
        let _ = delete_stored_entry(&connection, &id);
        Ok(())
    }
}

#[tauri::command]
pub fn clipboard_clear(state: State<ClipboardState>, db: State<Db>) {
    state.history.lock().unwrap().clear();
    let connection = db.0.lock().unwrap();
    let _ = clear_stored_entries(&connection);
}
