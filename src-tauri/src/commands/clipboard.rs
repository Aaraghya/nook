use tauri::State;

use crate::clipboard::{write_clipboard_text, ClipboardEntry, ClipboardState};

#[tauri::command]
pub fn clipboard_get_entries(state: State<ClipboardState>) -> Vec<ClipboardEntry> {
    state.history.lock().unwrap().clone()
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
pub fn clipboard_toggle_pin(state: State<ClipboardState>, id: String) -> Result<(), String> {
    let mut history = state.history.lock().unwrap();
    match history.iter_mut().find(|entry| entry.id == id) {
        Some(entry) => {
            entry.pinned = !entry.pinned;
            Ok(())
        }
        None => Err("clip not found".to_string()),
    }
}

#[tauri::command]
pub fn clipboard_delete(state: State<ClipboardState>, id: String) -> Result<(), String> {
    let mut history = state.history.lock().unwrap();
    let original_len = history.len();
    history.retain(|entry| entry.id != id);
    if history.len() == original_len {
        Err("clip not found".to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn clipboard_clear(state: State<ClipboardState>) {
    state.history.lock().unwrap().clear();
}
